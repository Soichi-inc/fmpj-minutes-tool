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

    // Styled HTML matching FMPJ official minutes format
    // Font: MS 明朝, Size: 10.5pt, Line-height: ~1.5, Page numbers: - N -
    const fullHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <style>
            @page {
              size: A4;
              margin: 25mm 25mm 25mm 25mm;
              mso-header-margin: 10mm;
              mso-footer-margin: 10mm;
              mso-page-numbers: 1;
            }
            @page Section1 {
              mso-footer: f1;
            }
            div.Section1 { page: Section1; }
            table#footer-table {
              border: none;
              margin: 0;
            }
            table#footer-table td {
              border: none;
              text-align: center;
              font-size: 9pt;
              padding: 0;
            }
            body {
              font-family: "MS 明朝", "ＭＳ 明朝", "MS Mincho", serif;
              font-size: 10.5pt;
              line-height: 1.5;
              color: #000;
            }
            h1 {
              font-family: "MS 明朝", "ＭＳ 明朝", "MS Mincho", serif;
              font-size: 14pt;
              font-weight: bold;
              text-align: center;
              margin: 0 0 2pt;
              line-height: 1.5;
            }
            h2 {
              font-family: "MS 明朝", "ＭＳ 明朝", "MS Mincho", serif;
              font-size: 12pt;
              font-weight: bold;
              text-align: center;
              margin: 0 0 12pt;
              line-height: 1.5;
            }
            h3 {
              font-family: "MS 明朝", "ＭＳ 明朝", "MS Mincho", serif;
              font-size: 10.5pt;
              font-weight: bold;
              margin: 8pt 0 4pt;
              line-height: 1.5;
            }
            p {
              margin: 0 0 0pt;
              line-height: 1.5;
              text-align: justify;
              text-justify: inter-ideograph;
            }
            ul, ol {
              margin: 0 0 2pt;
              padding-left: 18pt;
              line-height: 1.5;
            }
            li {
              margin: 0pt 0;
              line-height: 1.5;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 6pt 0;
              font-size: 9.5pt;
              line-height: 1.4;
            }
            th, td {
              border: 1px solid #000;
              padding: 3pt 6pt;
              text-align: left;
              vertical-align: top;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            strong { font-weight: bold; }
            pre, code {
              font-family: "MS ゴシック", "ＭＳ ゴシック", monospace;
              font-size: 9pt;
            }
          </style>
        </head>
        <body>
          <div class="Section1">
            ${htmlBody}
          </div>
        </body>
      </html>
    `;

    // Dynamic import html-to-docx
    const HTMLtoDOCX = (await import("html-to-docx")).default;

    const docxBuffer = await HTMLtoDOCX(fullHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
      font: "MS 明朝",
      fontSize: 21, // 10.5pt in half-points
      margins: {
        top: 1418,  // ~25mm
        right: 1418,
        bottom: 1418,
        left: 1418,
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
