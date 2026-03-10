import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { verifyAuth } from "@/lib/auth";

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

  const id = crypto.randomUUID();
  const data = {
    id,
    meetingType: meetingType || "その他",
    meetingName: meetingName || "",
    date: date || "",
    originalContent: originalContent || "",
    finalContent,
    createdAt: new Date().toISOString(),
  };

  const blob = await put(`learning/${id}.json`, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
  });

  return NextResponse.json({ id, url: blob.url });
}
