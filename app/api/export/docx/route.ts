import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { marked } from "marked";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const auth = cookieStore.get("fmpj-auth");
  if (!auth || auth.value !== "authenticated") {
    return Response.json({ error: "未認証" }, { status: 401 });
  }

  try {
    const { content, fileName } = await request.json();

    if (!content) {
      return Response.json(
        { error: "コンテンツが必要です" },
        { status: 400 }
      );
    }

    // Convert markdown to HTML
    const htmlBody = await marked(content, {
      gfm: true,
      breaks: true,
    });

    // Styled HTML for Word
    const fullHtml = `
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: "游明朝", "Yu Mincho", "MS 明朝", serif;
              font-size: 10.5pt;
              line-height: 1.8;
              color: #000;
            }
            h1 { font-size: 16pt; font-weight: bold; margin: 12pt 0 6pt; }
            h2 { font-size: 14pt; font-weight: bold; margin: 12pt 0 6pt; }
            h3 { font-size: 12pt; font-weight: bold; margin: 10pt 0 4pt; }
            p { margin: 0 0 6pt; }
            ul, ol { margin: 0 0 6pt; padding-left: 20pt; }
            li { margin: 2pt 0; }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 8pt 0;
              font-size: 9.5pt;
            }
            th, td {
              border: 1px solid #333;
              padding: 4pt 8pt;
              text-align: left;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            strong { font-weight: bold; }
            pre { font-family: "MS ゴシック", monospace; font-size: 9pt; }
          </style>
        </head>
        <body>${htmlBody}</body>
      </html>
    `;

    // Dynamic import html-to-docx
    const HTMLtoDOCX = (await import("html-to-docx")).default;

    const docxBuffer = await HTMLtoDOCX(fullHtml, null, {
      table: { row: { cantSplit: true } },
      footer: false,
      pageNumber: false,
      font: "游明朝",
      fontSize: 21, // 10.5pt in half-points
      margins: {
        top: 1440, // 1 inch
        right: 1440,
        bottom: 1440,
        left: 1440,
      },
    });

    const safeName =
      fileName || `議事録_${new Date().toISOString().split("T")[0]}`;

    // Convert Buffer to Uint8Array for Response constructor
    const uint8 = new Uint8Array(docxBuffer);
    return new Response(uint8, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}.docx"`,
      },
    });
  } catch (error) {
    console.error("DOCX export error:", error);
    const message =
      error instanceof Error ? error.message : "Word出力に失敗しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
