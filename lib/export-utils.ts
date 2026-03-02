import { marked } from "marked";

/**
 * Convert markdown to styled HTML suitable for Word/PDF export.
 */
async function markdownToHtml(markdownContent: string): Promise<string> {
  return await marked(markdownContent, { gfm: true, breaks: true });
}

/**
 * FMPJ議事録フォーマット用のCSSスタイル
 * Font: MS 明朝, Size: 10.5pt, Line-height: 1.5
 */
const FMPJ_STYLE = `
  @page {
    size: A4;
    margin: 25mm;
  }
  body {
    font-family: "MS 明朝", "ＭＳ 明朝", "MS Mincho", "Yu Mincho", "游明朝", serif;
    font-size: 10.5pt;
    line-height: 1.5;
    color: #000;
    text-align: justify;
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
    margin: 8pt 0 4pt;
    line-height: 1.5;
  }
  p {
    margin: 0 0 2pt;
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
`;

/**
 * Download markdown content as a Word (.doc) file.
 * Uses HTML with MS Word XML declarations for native Word compatibility.
 */
export async function downloadAsWord(
  markdownContent: string,
  fileName: string
) {
  const htmlBody = await markdownToHtml(markdownContent);

  const wordHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
${FMPJ_STYLE}
</style>
</head>
<body>
${htmlBody}
</body>
</html>`;

  // BOM + HTML for proper encoding in Word
  const blob = new Blob(["\ufeff" + wordHtml], {
    type: "application/msword;charset=utf-8",
  });
  triggerDownload(blob, `${fileName}.doc`);
}

/**
 * Download markdown content as a PDF file.
 * Renders HTML in a temporary element and captures it with html2canvas + jsPDF.
 */
export async function downloadAsPdf(
  markdownContent: string,
  fileName: string
) {
  const htmlBody = await markdownToHtml(markdownContent);

  // Create a temporary container with A4-like styling
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 700px;
    padding: 40px;
    background: white;
    font-family: "MS 明朝", "Yu Mincho", "游明朝", serif;
    font-size: 14px;
    line-height: 1.5;
    color: #000;
  `;
  container.innerHTML = `<style>
    h1 { font-size: 18px; font-weight: bold; text-align: center; margin: 0 0 2px; }
    h2 { font-size: 16px; font-weight: bold; text-align: center; margin: 0 0 10px; }
    h3 { font-size: 14px; font-weight: bold; margin: 10px 0 4px; }
    p { margin: 0 0 3px; }
    ul, ol { margin: 0 0 3px; padding-left: 20px; }
    li { margin: 0; }
    table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12px; }
    th, td { border: 1px solid #000; padding: 4px 8px; text-align: left; vertical-align: top; }
    th { background-color: #f0f0f0; font-weight: bold; }
  </style>${htmlBody}`;

  document.body.appendChild(container);

  try {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15; // mm

    const contentWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    const usableHeight = pageHeight - margin * 2;

    let position = 0;
    let pageNum = 0;

    while (position < imgHeight) {
      if (pageNum > 0) {
        pdf.addPage();
      }

      // Calculate the source crop for this page
      const sourceY = (position / imgHeight) * canvas.height;
      const sourceHeight = Math.min(
        (usableHeight / imgHeight) * canvas.height,
        canvas.height - sourceY
      );
      const destHeight = (sourceHeight / canvas.height) * imgHeight;

      // Create a cropped canvas for this page
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceHeight;
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sourceHeight,
          0,
          0,
          canvas.width,
          sourceHeight
        );
      }

      const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.95);
      pdf.addImage(
        pageImgData,
        "JPEG",
        margin,
        margin,
        contentWidth,
        destHeight
      );

      position += usableHeight;
      pageNum++;
    }

    pdf.save(`${fileName}.pdf`);
  } finally {
    document.body.removeChild(container);
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
