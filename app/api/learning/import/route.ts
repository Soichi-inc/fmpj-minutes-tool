import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { extractText } from "@/lib/file-parser";

export const runtime = "nodejs";

/**
 * Import a past minutes document (Word/PDF/txt) and extract text for A'.
 * Accepts FormData with a file field.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("fmpj-auth");
  if (!auth || auth.value !== "authenticated") {
    return NextResponse.json({ error: "未認証" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが必要です" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractText(buffer, file.name);

    if (!text.trim()) {
      return NextResponse.json(
        { error: "ファイルからテキストを抽出できませんでした" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      fileName: file.name,
      text,
      textLength: text.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "ファイルの処理に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
