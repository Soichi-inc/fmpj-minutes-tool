import { NextRequest } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { del } from "@vercel/blob";
import {
  WHISPER_CHUNK_SIZE,
  MAX_AUDIO_DURATION_MINUTES,
  WHISPER_CONCURRENCY,
} from "@/lib/audio-constants";
import { verifyAuth } from "@/lib/auth";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Pro max (5 min function timeout)

const WHISPER_API_LIMIT = WHISPER_CHUNK_SIZE;

/**
 * mp3以外の音声ファイルをffmpegでmp3に変換する。
 * mp3とwavの場合はそのまま返す。
 */
async function convertToMp3(
  buffer: ArrayBuffer,
  fileName: string
): Promise<{ buffer: ArrayBuffer; fileName: string }> {
  const ext = (fileName || "").split(".").pop()?.toLowerCase();

  // mp3とwavはそのまま（wavは既存のsplitWavで対応済み）
  if (ext === "mp3" || ext === "wav" || ext === "mpga" || ext === "mpeg") {
    return { buffer, fileName };
  }

  // ffmpegでmp3に変換
  const id = Date.now() + "_" + Math.random().toString(36).slice(2);
  const inputPath = join(tmpdir(), `input_${id}.${ext}`);
  const outputPath = join(tmpdir(), `output_${id}.mp3`);

  try {
    await writeFile(inputPath, Buffer.from(buffer));

    if (!ffmpegPath) throw new Error("ffmpeg-static path not found");

    await execFileAsync(ffmpegPath, [
      "-i", inputPath,
      "-vn",                // 映像トラックを除外
      "-acodec", "libmp3lame",
      "-ab", "128k",        // ビットレート
      "-ar", "16000",       // サンプルレート（Whisperに最適）
      "-ac", "1",           // モノラル（Whisperに最適）
      "-y",                 // 上書き
      outputPath,
    ], { timeout: 120000 }); // 2分タイムアウト

    const mp3Buffer = await readFile(outputPath);
    const newFileName = fileName.replace(/\.[^.]+$/, ".mp3");

    return {
      buffer: mp3Buffer.buffer.slice(
        mp3Buffer.byteOffset,
        mp3Buffer.byteOffset + mp3Buffer.byteLength
      ),
      fileName: newFileName,
    };
  } finally {
    // 一時ファイル削除（エラーでも）
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyAuth())) {
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

        // mp3/wav以外はffmpegでmp3に変換（m4a, mp4, webm等の互換性問題を解決）
        send({ status: "converting", message: "音声フォーマットを変換中..." });
        const converted = await convertToMp3(audioBuffer, fileName);
        const processBuffer = converted.buffer;
        const processFileName = converted.fileName;

        const fileSizeMB = (processBuffer.byteLength / 1024 / 1024).toFixed(1);

        if (processBuffer.byteLength <= WHISPER_API_LIMIT) {
          // ── Single chunk ──
          send({
            status: "transcribing",
            message: `文字起こし中...（${fileSizeMB}MB）`,
          });

          const result = await transcribeBuffer(processBuffer, processFileName);

          if (!result.text.trim()) {
            throw new Error(
              "文字起こし結果が空です。音声ファイルを確認してください。"
            );
          }

          // Duration check (single file)
          if (
            result.duration > 0 &&
            result.duration > MAX_AUDIO_DURATION_MINUTES * 60
          ) {
            throw new Error(
              `音声が${MAX_AUDIO_DURATION_MINUTES}分を超えています。短い音声に分割してください。`
            );
          }

          send({ status: "done", transcript: result.text });
        } else {
          // ── Multi-chunk: split → parallel transcribe → merge ──
          const ext = (processFileName || "").split(".").pop()?.toLowerCase();
          const chunks = splitAudioBuffer(processBuffer, ext);
          const totalChunks = chunks.length;

          send({
            status: "transcribing",
            message: `大きいファイル（${fileSizeMB}MB）を${totalChunks}個に分割して並列処理中...`,
          });

          // Process chunks in parallel with concurrency limit
          const results: ChunkResult[] = new Array(totalChunks);
          let completed = 0;

          const processChunk = async (index: number) => {
            const result = await transcribeBuffer(
              chunks[index],
              getChunkFileName(processFileName, index)
            );
            results[index] = result;
            completed++;
            send({
              status: "transcribing",
              message: `文字起こし中... (${completed}/${totalChunks} 完了)`,
            });
          };

          // Run with concurrency limit
          await runWithConcurrency(
            chunks.map((_, i) => () => processChunk(i)),
            WHISPER_CONCURRENCY
          );

          // Calculate cumulative time offsets from each chunk's duration
          let offset = 0;
          const allSegments: Array<{ start: number; text: string }> = [];

          for (const result of results) {
            for (const seg of result.localSegments) {
              allSegments.push({
                start: seg.start + offset,
                text: seg.text,
              });
            }
            offset += result.duration;
          }

          // Duration check (total)
          const totalDuration = offset;
          if (totalDuration > MAX_AUDIO_DURATION_MINUTES * 60) {
            throw new Error(
              `音声の合計が約${Math.round(totalDuration / 60)}分あり、上限の${MAX_AUDIO_DURATION_MINUTES}分を超えています。`
            );
          }

          const formattedTranscript = formatSegments(allSegments);
          if (!formattedTranscript.trim()) {
            throw new Error(
              "文字起こし結果が空です。音声ファイルを確認してください。"
            );
          }

          send({
            status: "done",
            transcript: formattedTranscript,
          });
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

// ─── Concurrency helper ───

async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  limit: number
): Promise<void> {
  const executing: Set<Promise<void>> = new Set();

  for (const task of tasks) {
    const p = task().then(() => {
      executing.delete(p);
    });
    executing.add(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

// ─── Audio splitting ───

function splitAudioBuffer(
  buffer: ArrayBuffer,
  ext?: string
): ArrayBuffer[] {
  if (ext === "wav") {
    return splitWav(buffer);
  }
  return splitRaw(buffer);
}

/**
 * WAV: copy header to each chunk → each chunk is a valid WAV file.
 */
function splitWav(buffer: ArrayBuffer): ArrayBuffer[] {
  const view = new DataView(buffer);

  let headerEnd = 12;
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
    if (subChunkSize % 2 !== 0) headerEnd++;
  }

  if (dataOffset === 0) {
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

    chunkArr.set(headerBytes);
    chunkArr.set(
      new Uint8Array(buffer, dataOffset + i, thisDataSize),
      headerSize
    );

    const dv = new DataView(chunkBuf);
    dv.setUint32(4, chunkBuf.byteLength - 8, true);
    dv.setUint32(headerSize - 4, thisDataSize, true);

    chunks.push(chunkBuf);
  }

  return chunks;
}

/**
 * Raw binary splitting for MP3 / M4A etc.
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

// ─── Whisper API ───

interface ChunkResult {
  text: string;
  /** Segments with timestamps LOCAL to this chunk (no offset applied) */
  localSegments: Array<{ start: number; text: string }>;
  /** Whisper-reported duration of this chunk in seconds */
  duration: number;
}

async function transcribeBuffer(
  buffer: ArrayBuffer,
  fileName: string
): Promise<ChunkResult> {
  const contentType = getContentType(fileName);
  let safeFileName = fileName || "audio.mp3";
  if (safeFileName.toLowerCase().endsWith(".m4a")) {
    safeFileName = safeFileName.replace(/\.m4a$/i, ".mp4");
  }
  const file = new File([buffer], safeFileName, {
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

  // verbose_json レスポンスは TranscriptionVerbose 型で
  // segments と duration が正規プロパティとして定義されている
  const rawSegments = transcription.segments || [];

  const localSegments = rawSegments.map((seg) => ({
    start: seg.start,
    text: seg.text.trim(),
  }));

  const duration = transcription.duration || 0;

  return {
    text: formatSegments(localSegments),
    localSegments,
    duration,
  };
}

// ─── Helpers ───

function getChunkFileName(
  fileName: string | undefined,
  index: number
): string {
  if (!fileName) return `chunk_${index}.mp3`;
  let ext = fileName.split(".").pop() || "mp3";
  if (ext.toLowerCase() === "m4a") ext = "mp4";
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

/**
 * Whisperのセグメントをタイムスタンプ付きテキストに変換する。
 * 注意: Whisper APIは話者分離（speaker diarization）に対応していないため、
 * すべてのセグメントが "Speaker 1" としてラベル付けされる。
 * 話者の識別はフロントエンドの SpeakerMapping コンポーネントでユーザーが手動で行う。
 */
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
