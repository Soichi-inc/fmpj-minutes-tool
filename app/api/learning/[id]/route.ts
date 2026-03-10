import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { list, del } from "@vercel/blob";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "未認証" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { blobs } = await list({ prefix: `learning/${id}` });
    if (blobs.length === 0) {
      return NextResponse.json(
        { error: "学習データが見つかりません" },
        { status: 404 }
      );
    }

    const res = await fetch(blobs[0].url);
    if (!res.ok) {
      return NextResponse.json(
        { error: "データの取得に失敗しました" },
        { status: 500 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "エラーが発生しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "未認証" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { blobs } = await list({ prefix: `learning/${id}` });
    if (blobs.length === 0) {
      return NextResponse.json(
        { error: "学習データが見つかりません" },
        { status: 404 }
      );
    }

    await del(blobs[0].url);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "削除に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
