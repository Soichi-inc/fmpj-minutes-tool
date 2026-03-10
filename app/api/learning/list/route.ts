import { NextRequest, NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { verifyAuth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "未認証" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const meetingType = searchParams.get("meetingType");

  try {
    const { blobs } = await list({ prefix: "learning/" });
    const pairs: Array<{
      id: string;
      meetingType: string;
      meetingName: string;
      date: string;
      createdAt: string;
      url: string;
      originalLength: number;
      finalLength: number;
    }> = [];

    await Promise.all(
      blobs.map(async (blob) => {
        try {
          const res = await fetch(blob.url);
          if (!res.ok) return;
          const data = await res.json();
          if (meetingType && data.meetingType !== meetingType) return;
          pairs.push({
            id: data.id,
            meetingType: data.meetingType,
            meetingName: data.meetingName,
            date: data.date,
            createdAt: data.createdAt,
            url: blob.url,
            originalLength: data.originalContent?.length || 0,
            finalLength: data.finalContent?.length || 0,
          });
        } catch {
          // Skip corrupted entries
        }
      })
    );

    pairs.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ learningPairs: pairs });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "データ取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
