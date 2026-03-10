import { marked } from "marked";
import { generateDocx } from "./docx-builder";

/**
 * Convert markdown to styled HTML (used for PDF print).
 */
async function markdownToHtml(markdownContent: string): Promise<string> {
  return await marked(markdownContent, { gfm: true, breaks: true });
}

/**
 * PDF印刷用のCSSスタイル
 * Font: MS 明朝, Size: 10.5pt, A4, 余白25mm
 */
const FMPJ_PDF_STYLE = `
  @page {
    size: A4;
    margin: 25mm;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body {
    font-family: "MS 明朝", "ＭＳ 明朝", "MS Mincho", "Yu Mincho", "游明朝", "Hiragino Mincho ProN", serif;
    font-size: 10.5pt;
    line-height: 1.5;
    color: #000;
    text-align: left;
    padding: 0;
    margin: 0;
  }
  h1 {
    font-size: 14pt;
    font-weight: bold;
    text-align: center;
    margin: 0 0 2pt;
    line-height: 1.5;
  }
  h2 {
    font-size: 12pt;
    font-weight: bold;
    text-align: center;
    margin: 0 0 10pt;
    line-height: 1.5;
  }
  h3 {
    font-size: 10.5pt;
    font-weight: bold;
    text-align: left;
    margin: 8pt 0 4pt;
    line-height: 1.5;
  }
  p {
    margin: 0 0 2pt;
    text-align: left;
    line-height: 1.5;
  }
  ul, ol {
    margin: 0 0 2pt;
    padding-left: 18pt;
    line-height: 1.5;
  }
  li {
    margin: 0;
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
  @media print {
    body { margin: 0; padding: 0; }
  }
`;

/**
 * Download markdown content as a proper Word (.docx) file.
 * Uses JSZip to generate valid Office Open XML.
 */
export async function downloadAsWord(
  markdownContent: string,
  fileName: string
) {
  const blob = await generateDocx(markdownContent);
  triggerDownload(blob, `${fileName}.docx`);
}

/**
 * Download markdown content as a PDF file.
 * Uses a hidden iframe with print dialog for reliable Japanese text rendering.
 * ブラウザ側では印刷ダイアログ経由が日本語フォント対応の最も確実な方法。
 */
export async function downloadAsPdf(
  markdownContent: string,
  fileName: string
) {
  const htmlBody = await markdownToHtml(markdownContent);

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${fileName}</title>
<style>
${FMPJ_PDF_STYLE}
</style>
</head>
<body>
${htmlBody}
</body>
</html>`;

  // Create a hidden iframe for printing
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:0;height:0;border:none;";
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error("iframe document にアクセスできません");
    }

    iframeDoc.open();
    iframeDoc.write(fullHtml);
    iframeDoc.close();

    // Wait for content to render
    await new Promise<void>((resolve) => {
      if (iframe.contentWindow) {
        iframe.contentWindow.onload = () => resolve();
        setTimeout(resolve, 1000);
      } else {
        setTimeout(resolve, 1000);
      }
    });

    // Trigger print dialog (user can choose "Save as PDF")
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    // Remove iframe after a delay to allow print dialog
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 3000);
  } catch {
    document.body.removeChild(iframe);
    throw new Error("PDF出力の準備に失敗しました");
  }
}

/**
 * Trigger a file download in the browser.
 */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
