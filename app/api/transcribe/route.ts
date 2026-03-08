import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getOpenAIClient } from "@/lib/openai";
import { del } from "@vercel/blob";
import { WHISPER_CHUNK_SIZE } from "@/lib/audio-constants";

export const runtime = "nodejs";
export const maxDuration = 600; // 10 minutes for large files with multiple chunks

const WHISPER_API_LIMIT = WHISPER_CHUNK_SIZE;

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("fmpj-auth");
  if (!auth || auth.value !== "authenticated") {
    return new Response(JSON.stringify({ error: "未認証" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { blobUrl, fileName } = await request.json();
  if (!blobUrl) {
    return new Response(
      JSON.stringify({ error: "音声ファイルURLが必要です" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        send({ status: "downloading", message: "音声ファイルを準備中..." });

        const audioResponse = await fetch(blobUrl);
        if (!audioResponse.ok) {
          throw new Error("音声ファイルの取得に失敗しました");
        }
        const audioBuffer = await audioResponse.arrayBuffer();
        const fileSizeMB = (audioBuffer.byteLength / 1024 / 1024).toFixed(1);

        if (audioBuffer.byteLength <= WHISPER_API_LIMIT) {
          // ── Single chunk: existing flow ──
          send({
            status: "transcribing",
            message: `文字起こし中...（${fileSizeMB}MB）`,
          });

          const transcript = await transcribeBuffer(
            audioBuffer,
            fileName,
            0
          );

          if (!transcript.text.trim()) {
            throw new Error(
              "文字起こし結果が空です。音声ファイルを確認してください。"
            );
          }

          send({ status: "done", transcript: transcript.text });
        } else {
          // ── Multi-chunk: split and transcribe ──
          const chunks = splitAudioBuffer(audioBuffer, fileName);
          const totalChunks = chunks.length;

          send({
            status: "transcribing",
            message: `大きいファイル（${fileSizeMB}MB）を${totalChunks}個に分割して文字起こし中...`,
          });

          let allSegments: Array<{ start: number; text: string }> = [];
          let timeOffset = 0;

          for (let i = 0; i < totalChunks; i++) {
            send({
              status: "transcribing",
              message: `文字起こし中... (${i + 1}/${totalChunks})`,
            });

            const result = await transcribeBuffer(
              chunks[i],
              getChunkFileName(fileName, i),
              timeOffset
            );

            allSegments = allSegments.concat(result.segments);

            // Use Whisper's reported duration for offset
            if (result.duration > 0) {
              timeOffset += result.duration;
            }
          }

          const formattedTranscript = formatSegments(allSegments);
          if (!formattedTranscript.trim()) {
            throw new Error(
              "文字起こし結果が空です。音声ファイルを確認してください。"
            );
          }

          send({ status: "done", transcript: formattedTranscript });
        }

        // Clean up temp blob
        try {
          await del(blobUrl);
        } catch {
          // Non-critical
        }

        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "文字起こしに失敗しました";
        send({ status: "error", error: message });
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ─── Audio splitting ───

function splitAudioBuffer(
  buffer: ArrayBuffer,
  fileName?: string
): ArrayBuffer[] {
  const ext = (fileName || "").split(".").pop()?.toLowerCase();

  if (ext === "wav") {
    return splitWav(buffer);
  }
  // MP3, M4A, etc.: raw binary splitting
  return splitRaw(buffer);
}

/**
 * WAV splitting: copy the header to each chunk so every chunk is a valid WAV.
 */
function splitWav(buffer: ArrayBuffer): ArrayBuffer[] {
  const view = new DataView(buffer);

  // Find the "data" sub-chunk
  let headerEnd = 12; // skip RIFF + size + WAVE
  let dataOffset = 0;
  let dataSize = 0;

  while (headerEnd < Math.min(buffer.byteLength, 1024)) {
    const id = String.fromCharCode(
      view.getUint8(headerEnd),
      view.getUint8(headerEnd + 1),
      view.getUint8(headerEnd + 2),
      view.getUint8(headerEnd + 3)
    );
    const subChunkSize = view.getUint32(headerEnd + 4, true);

    if (id === "data") {
      dataOffset = headerEnd + 8;
      dataSize = subChunkSize;
      break;
    }
    headerEnd += 8 + subChunkSize;
    if (subChunkSize % 2 !== 0) headerEnd++; // padding byte
  }

  if (dataOffset === 0) {
    // Couldn't parse WAV header; fall back to raw splitting
    return splitRaw(buffer);
  }

  const headerSize = dataOffset;
  const headerBytes = new Uint8Array(buffer, 0, headerSize);
  const maxDataPerChunk = WHISPER_API_LIMIT - headerSize;
  const chunks: ArrayBuffer[] = [];

  for (let i = 0; i < dataSize; i += maxDataPerChunk) {
    const thisDataSize = Math.min(maxDataPerChunk, dataSize - i);
    const chunkBuf = new ArrayBuffer(headerSize + thisDataSize);
    const chunkArr = new Uint8Array(chunkBuf);

    // Copy header
    chunkArr.set(headerBytes);
    // Copy audio data
    chunkArr.set(
      new Uint8Array(buffer, dataOffset + i, thisDataSize),
      headerSize
    );

    // Fix RIFF total size
    const dv = new DataView(chunkBuf);
    dv.setUint32(4, chunkBuf.byteLength - 8, true);
    // Fix data chunk size (it's 4 bytes before dataOffset in the header)
    dv.setUint32(headerSize - 4, thisDataSize, true);

    chunks.push(chunkBuf);
  }

  return chunks;
}

/**
 * Raw binary splitting for MP3 / M4A / other compressed formats.
 * MP3 frames are self-contained so decoders can re-sync.
 */
function splitRaw(buffer: ArrayBuffer): ArrayBuffer[] {
  const chunks: ArrayBuffer[] = [];
  const totalSize = buffer.byteLength;

  for (let offset = 0; offset < totalSize; offset += WHISPER_API_LIMIT) {
    const end = Math.min(offset + WHISPER_API_LIMIT, totalSize);
    chunks.push(buffer.slice(offset, end));
  }

  return chunks;
}

// ─── Whisper API call ───

interface TranscribeResult {
  text: string;
  segments: Array<{ start: number; text: string }>;
  duration: number;
}

async function transcribeBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  timeOffset: number
): Promise<TranscribeResult> {
  const contentType = getContentType(fileName);
  const file = new File([buffer], fileName || "audio.mp3", {
    type: contentType,
  });

  const openai = getOpenAIClient();
  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: file,
    response_format: "verbose_json",
    language: "ja",
    timestamp_granularities: ["segment"],
  });

  // Extract segments with offset applied
  const rawSegments: Array<{ start: number; text: string }> =
    (
      transcription as unknown as {
        segments?: Array<{ start: number; end: number; text: string }>;
      }
    ).segments || [];

  const segments = rawSegments.map((seg) => ({
    start: seg.start + timeOffset,
    text: seg.text.trim(),
  }));

  const duration =
    (transcription as unknown as { duration?: number }).duration || 0;

  return {
    text: formatSegments(segments),
    segments,
    duration,
  };
}

// ─── Helpers ───

function getChunkFileName(
  fileName: string | undefined,
  index: number
): string {
  if (!fileName) return `chunk_${index}.mp3`;
  const ext = fileName.split(".").pop() || "mp3";
  const base = fileName.replace(/\.[^.]+$/, "");
  return `${base}_chunk${index}.${ext}`;
}

function getContentType(fileName?: string): string {
  if (!fileName) return "audio/mpeg";
  const ext = fileName.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    webm: "audio/webm",
    mp4: "audio/mp4",
    mpeg: "audio/mpeg",
    mpga: "audio/mpeg",
  };
  return map[ext || ""] || "audio/mpeg";
}

function formatSegments(
  segments: Array<{ start: number; text: string }>
): string {
  if (segments.length === 0) return "";

  return segments
    .map((seg) => {
      const minutes = Math.floor(seg.start / 60);
      const seconds = Math.floor(seg.start % 60);
      const timestamp = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      return `Speaker 1 ${timestamp}\n${seg.text}`;
    })
    .join("\n\n");
}
