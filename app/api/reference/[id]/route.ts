import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { list, del } from "@vercel/blob";

export const runtime = "nodejs";

// GET: Fetch full reference data (including text) by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("fmpj-auth");
  if (!auth || auth.value !== "authenticated") {
    return Response.json({ error: "未認証" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { blobs } = await list({ prefix: `references/${id}.json` });
    if (blobs.length === 0) {
      return Response.json(
        { error: "参考資料が見つかりません" },
        { status: 404 }
      );
    }

    const res = await fetch(blobs[0].url);
    if (!res.ok) {
      return Response.json(
        { error: "データの取得に失敗しました" },
        { status: 500 }
      );
    }

    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "取得に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}

// DELETE: Remove a reference by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("fmpj-auth");
  if (!auth || auth.value !== "authenticated") {
    return Response.json({ error: "未認証" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { blobs } = await list({ prefix: `references/${id}.json` });
    if (blobs.length === 0) {
      return Response.json(
        { error: "参考資料が見つかりません" },
        { status: 404 }
      );
    }

    await del(blobs[0].url);
    return Response.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "削除に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
