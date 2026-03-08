import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getOpenAIClient } from "@/lib/openai";
import { del } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for long audio

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
      try {
        // Progress: downloading
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ status: "downloading", message: "音声ファイルを準備中..." })}\n\n`
          )
        );

        const audioResponse = await fetch(blobUrl);
        if (!audioResponse.ok) {
          throw new Error("音声ファイルの取得に失敗しました");
        }
        const audioBuffer = await audioResponse.arrayBuffer();

        if (audioBuffer.byteLength > 25 * 1024 * 1024) {
          throw new Error(
            "ファイルサイズが25MBを超えています。MP3に変換するか、短い音声ファイルに分割してください。"
          );
        }

        // Progress: transcribing
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ status: "transcribing", message: "文字起こし中...（1〜5分かかる場合があります）" })}\n\n`
          )
        );

        const contentType = getContentType(fileName);
        const file = new File([audioBuffer], fileName || "audio.mp3", {
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

        const formattedTranscript = formatWhisperOutput(transcription);

        if (!formattedTranscript.trim()) {
          throw new Error(
            "文字起こし結果が空です。音声ファイルを確認してください。"
          );
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ status: "done", transcript: formattedTranscript })}\n\n`
          )
        );

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
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ status: "error", error: message })}\n\n`
          )
        );
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

function formatWhisperOutput(transcription: {
  text?: string;
  segments?: Array<{ start: number; text: string }>;
}): string {
  if (!transcription.segments || transcription.segments.length === 0) {
    return transcription.text || "";
  }

  return transcription.segments
    .map((seg) => {
      const minutes = Math.floor(seg.start / 60);
      const seconds = Math.floor(seg.start % 60);
      const timestamp = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      return `Speaker 1 ${timestamp}\n${seg.text.trim()}`;
    })
    .join("\n\n");
}
