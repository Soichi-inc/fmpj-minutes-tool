import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifyAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "未認証" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          addRandomSuffix: true,
          allowedContentTypes: [
            "audio/mpeg",
            "audio/mp4",
            "audio/x-m4a",
            "audio/wav",
            "audio/x-wav",
            "audio/webm",
            "audio/mp4a-latm",
          ],
          maximumSizeInBytes: 200 * 1024 * 1024, // 200MB
        };
      },
      onUploadCompleted: async () => {
        // No server-side processing after upload
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[audio/upload] Error:", error);
    const message =
      error instanceof Error ? error.message : "アップロードに失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
