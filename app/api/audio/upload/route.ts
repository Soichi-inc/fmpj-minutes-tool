import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("fmpj-auth");
  if (!auth || auth.value !== "authenticated") {
    return NextResponse.json({ error: "未認証" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: [
            "audio/mpeg",
            "audio/mp4",
            "audio/x-m4a",
            "audio/wav",
            "audio/x-wav",
            "audio/webm",
            "audio/mp4a-latm",
          ],
          maximumSizeInBytes: 25 * 1024 * 1024, // 25MB
        };
      },
      onUploadCompleted: async () => {
        // No server-side processing after upload
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "アップロードに失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
