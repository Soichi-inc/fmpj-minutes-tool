import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { extractText, SUPPORTED_EXTENSIONS, MAX_FILE_SIZE } from "@/lib/file-parser";
import { verifyAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!(await verifyAuth())) {
    return Response.json({ error: "未認証" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "ファイルが必要です" }, { status: 400 });
    }

    // Validate file extension
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return Response.json(
        {
          error: `未対応のファイル形式: ${ext}（対応形式: ${SUPPORTED_EXTENSIONS.join(", ")}）`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "ファイルサイズが上限（10MB）を超えています" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract text content
    let text: string;
    try {
      text = await extractText(buffer, file.name);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "テキスト抽出に失敗しました";
      return Response.json({ error: msg }, { status: 400 });
    }

    if (!text.trim()) {
      return Response.json(
        { error: "ファイルからテキストを抽出できませんでした" },
        { status: 400 }
      );
    }

    // Store in Vercel Blob
    const id = crypto.randomUUID();
    const data = {
      id,
      fileName: file.name,
      fileSize: file.size,
      text,
      textLength: text.length,
      uploadedAt: new Date().toISOString(),
    };

    const blob = await put(`references/${id}.json`, JSON.stringify(data), {
      access: "public",
      contentType: "application/json",
    });

    return Response.json({
      id: data.id,
      fileName: data.fileName,
      fileSize: data.fileSize,
      textLength: data.textLength,
      uploadedAt: data.uploadedAt,
      url: blob.url,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "アップロードに失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
