import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { list, del } from "@vercel/blob";

export const runtime = "nodejs";

/**
 * IDからblobを検索する。
 * 新形式 learning/{meetingType}/{id}.json と旧形式 learning/{id}.json の両方に対応。
 */
async function findBlobById(id: string) {
  // まず旧形式（直下）を試行
  const { blobs: directBlobs } = await list({ prefix: `learning/${id}` });
  if (directBlobs.length > 0) return directBlobs[0];

  // 新形式: learning/ 以下を走査して {id}.json を探す
  const { blobs: allBlobs } = await list({ prefix: "learning/" });
  return allBlobs.find((b) => b.pathname.endsWith(`/${id}.json`)) || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAuth())) {
    return NextResponse.json({ error: "未認証" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const blob = await findBlobById(id);
    if (!blob) {
      return NextResponse.json(
        { error: "学習データが見つかりません" },
        { status: 404 }
      );
    }

    const res = await fetch(blob.url);
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
    const blob = await findBlobById(id);
    if (!blob) {
      return NextResponse.json(
        { error: "学習データが見つかりません" },
        { status: 404 }
      );
    }

    await del(blob.url);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "削除に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
