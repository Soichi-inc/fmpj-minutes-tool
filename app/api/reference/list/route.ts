import { list } from "@vercel/blob";
import { verifyAuth } from "@/lib/auth";

export const runtime = "nodejs";

interface ReferenceMetadata {
  id: string;
  fileName: string;
  fileSize: number;
  textLength: number;
  uploadedAt: string;
  url: string;
}

export async function GET() {
  if (!(await verifyAuth())) {
    return Response.json({ error: "未認証" }, { status: 401 });
  }

  try {
    const { blobs } = await list({ prefix: "references/" });

    // Fetch each blob to get metadata
    const references: ReferenceMetadata[] = [];

    await Promise.all(
      blobs.map(async (blob) => {
        try {
          const res = await fetch(blob.url);
          if (!res.ok) return;
          const data = await res.json();
          references.push({
            id: data.id,
            fileName: data.fileName,
            fileSize: data.fileSize,
            textLength: data.textLength || data.text?.length || 0,
            uploadedAt: data.uploadedAt,
            url: blob.url,
          });
        } catch {
          // Skip blobs that can't be parsed
        }
      })
    );

    // Sort by upload date (newest first)
    references.sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    return Response.json({ references });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "一覧取得に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
