import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { list } from "@vercel/blob";
import { getAnthropicClient } from "@/lib/anthropic";
import { getSystemPrompt, buildUserMessage } from "@/lib/prompts/system-prompt";

export async function POST(request: NextRequest) {
  // Auth check
  const cookieStore = await cookies();
  const auth = cookieStore.get("fmpj-auth");
  if (!auth || auth.value !== "authenticated") {
    return new Response(JSON.stringify({ error: "未認証" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const {
      transcript,
      meetingName,
      meetingType,
      date,
      location,
      attendees,
      attendeeCategories,
      customFormatInstructions,
      sampleOutput,
      referenceTexts,
    } = await request.json();

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: "文字起こしデータが必要です" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 学習データから過去の確定版を取得してsampleOutputに追加
    let enrichedSampleOutput = sampleOutput || "";
    if (meetingType) {
      try {
        const { blobs } = await list({ prefix: "learning/" });
        const learningPairs: Array<{
          meetingType: string;
          finalContent: string;
          createdAt: string;
        }> = [];

        await Promise.all(
          blobs.map(async (blob) => {
            try {
              const res = await fetch(blob.url);
              if (!res.ok) return;
              const data = await res.json();
              if (data.meetingType === meetingType && data.finalContent) {
                learningPairs.push({
                  meetingType: data.meetingType,
                  finalContent: data.finalContent,
                  createdAt: data.createdAt,
                });
              }
            } catch {
              // Skip corrupted entries
            }
          })
        );

        // 直近2件を取得
        learningPairs.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const recentPairs = learningPairs.slice(0, 2);

        if (recentPairs.length > 0) {
          const learningSamples = recentPairs
            .map(
              (p, i) =>
                `--- 過去の確定済み議事録 ${i + 1} ---\n${p.finalContent}`
            )
            .join("\n\n");

          enrichedSampleOutput = enrichedSampleOutput
            ? `${enrichedSampleOutput}\n\n${learningSamples}`
            : learningSamples;
        }
      } catch {
        // 学習データ取得失敗時は無視して続行
      }
    }

    const systemPrompt = getSystemPrompt({
      meetingName: meetingName || "会議",
      meetingType: meetingType || "",
      date: date || "未指定",
      location: location || "未指定",
      attendees: attendees || [],
      attendeeCategories: attendeeCategories || undefined,
      customFormatInstructions: customFormatInstructions || undefined,
      sampleOutput: enrichedSampleOutput || undefined,
    });

    const userMessage = buildUserMessage(transcript, referenceTexts);

    const client = getAnthropicClient();

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    // Return as a streaming response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const chunk = encoder.encode(
                `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
              );
              controller.enqueue(chunk);
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: errorMessage })}\n\n`
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
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "不明なエラーが発生しました";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
