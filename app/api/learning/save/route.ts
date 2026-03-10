import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { verifyAuth } from "@/lib/auth";
import { extractTerminology } from "@/lib/terminology-extractor";
import { TermEntry } from "@/lib/store/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "未認証" }, { status: 401 });
  }

  const body = await request.json();
  const { meetingType, meetingName, date, originalContent, finalContent } =
    body;

  if (!finalContent) {
    return NextResponse.json(
      { error: "確定版の内容が必要です" },
      { status: 400 }
    );
  }

  // 用語辞書を自動抽出（失敗しても保存は続行）
  let terminology: TermEntry[] = [];
  try {
    terminology = await extractTerminology(finalContent);
  } catch {
    // 抽出失敗時は空配列のまま続行
  }

  const id = crypto.randomUUID();
  const data = {
    id,
    meetingType: meetingType || "その他",
    meetingName: meetingName || "",
    date: date || "",
    originalContent: originalContent || "",
    finalContent,
    terminology,
    createdAt: new Date().toISOString(),
  };

  const blob = await put(`learning/${id}.json`, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
  });

  return NextResponse.json({ id, url: blob.url });
}
