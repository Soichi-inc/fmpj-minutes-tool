import mammoth from "mammoth";
import * as XLSX from "xlsx";

/**
 * Extract text content from various document file types.
 * Supports: .docx, .xlsx, .xls, .pdf, .txt, .csv, .md, .pptx
 */
export async function extractText(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "docx":
      return extractDocx(buffer);
    case "xlsx":
    case "xls":
      return extractXlsx(buffer);
    case "pdf":
      return extractPdf(buffer);
    case "txt":
    case "csv":
    case "md":
      return buffer.toString("utf-8");
    case "pptx":
      return extractPptx(buffer);
    default:
      throw new Error(
        `未対応のファイル形式: .${ext}（対応形式: docx, xlsx, pdf, txt, csv, pptx）`
      );
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractXlsx(buffer: Buffer): string {
  const workbook = XLSX.read(buffer);
  let text = "";
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    text += `[シート: ${sheetName}]\n`;
    text += XLSX.utils.sheet_to_csv(sheet) + "\n\n";
  }
  return text.trim();
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid pdf-parse's test file loading at import time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractPptx(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slides: string[] = [];

  // PPTX files contain slide XML in ppt/slides/slideN.xml
  const slideFiles = Object.keys(zip.files)
    .filter((f) => f.match(/ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
      return numA - numB;
    });

  for (const slideFile of slideFiles) {
    const xml = await zip.files[slideFile].async("string");
    // Extract text from XML <a:t> tags
    const textMatches = xml.match(/<a:t>([^<]*)<\/a:t>/g);
    if (textMatches) {
      const texts = textMatches.map((m) => m.replace(/<\/?a:t>/g, ""));
      slides.push(texts.join(" "));
    }
  }

  return slides.map((s, i) => `[スライド ${i + 1}]\n${s}`).join("\n\n");
}

// Re-export constants from shared file for server-side convenience
export { SUPPORTED_EXTENSIONS, MAX_FILE_SIZE } from "./file-constants";
