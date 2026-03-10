/**
 * JSZipを使用して正規の.docxファイルを生成するモジュール。
 * .docxはZIP圧縮されたOffice Open XML (OOXML) フォーマット。
 *
 * 対応要素: 見出し(h1-h3)、段落、太字、箇条書き、番号付きリスト、テーブル
 */
import JSZip from "jszip";
import { marked, type Tokens } from "marked";

// ─── OOXML テンプレート ───

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const WORD_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

/** MS 明朝 10.5pt, A4用紙, 余白25mm のスタイル定義 */
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="MS 明朝" w:eastAsia="MS 明朝" w:hAnsi="MS 明朝"/>
        <w:sz w:val="21"/>
        <w:szCs w:val="21"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="360" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="40"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="200"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet">
    <w:name w:val="List Bullet"/>
    <w:pPr>
      <w:numPr><w:numId w:val="1"/></w:numPr>
      <w:spacing w:before="0" w:after="40"/>
      <w:ind w:left="360" w:hanging="360"/>
    </w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListNumber">
    <w:name w:val="List Number"/>
    <w:pPr>
      <w:numPr><w:numId w:val="2"/></w:numPr>
      <w:spacing w:before="0" w:after="40"/>
      <w:ind w:left="360" w:hanging="360"/>
    </w:pPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      </w:tblBorders>
    </w:tblPr>
  </w:style>
</w:styles>`;

const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="・"/>
      <w:lvlJc w:val="left"/>
    </w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

// ─── Markdown → OOXML 変換 ───

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** インラインテキスト（太字・通常）をw:rに変換 */
function inlineToRuns(text: string): string {
  // Simple bold detection: **text** or __text__
  const parts: string[] = [];
  const regex = /\*\*(.+?)\*\*|__(.+?)__/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      if (plain) parts.push(`<w:r><w:t xml:space="preserve">${escapeXml(plain)}</w:t></w:r>`);
    }
    const boldText = match[1] || match[2];
    parts.push(`<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(boldText)}</w:t></w:r>`);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining) parts.push(`<w:r><w:t xml:space="preserve">${escapeXml(remaining)}</w:t></w:r>`);
  }

  return parts.length > 0
    ? parts.join("")
    : `<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/** テーブルをOOXMLに変換 */
function tableToXml(token: Tokens.Table): string {
  const rows: string[] = [];

  // Header row
  if (token.header.length > 0) {
    const cells = token.header
      .map(
        (cell) =>
          `<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F0F0F0"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="19"/></w:rPr><w:t xml:space="preserve">${escapeXml(cell.text)}</w:t></w:r></w:p></w:tc>`
      )
      .join("");
    rows.push(`<w:tr>${cells}</w:tr>`);
  }

  // Body rows
  for (const row of token.rows) {
    const cells = row
      .map(
        (cell) =>
          `<w:tc><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="19"/></w:rPr><w:t xml:space="preserve">${escapeXml(cell.text)}</w:t></w:r></w:p></w:tc>`
      )
      .join("");
    rows.push(`<w:tr>${cells}</w:tr>`);
  }

  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>${rows.join("")}</w:tbl>`;
}

/** リストアイテムを再帰的にフラット化 */
function flattenListItems(
  items: Tokens.ListItem[],
  ordered: boolean
): string[] {
  const paras: string[] = [];
  const style = ordered ? "ListNumber" : "ListBullet";
  for (const item of items) {
    paras.push(
      `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${inlineToRuns(item.text)}</w:p>`
    );
  }
  return paras;
}

/**
 * Markdownをパースし、OOXML段落の配列に変換する。
 */
function markdownToOoxml(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  const paragraphs: string[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const level = Math.min(token.depth, 3);
        const style = `Heading${level}`;
        paragraphs.push(
          `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${inlineToRuns(token.text)}</w:p>`
        );
        break;
      }
      case "paragraph":
        paragraphs.push(
          `<w:p><w:pPr><w:spacing w:before="0" w:after="40"/></w:pPr>${inlineToRuns(token.text)}</w:p>`
        );
        break;
      case "list":
        paragraphs.push(
          ...flattenListItems(token.items, token.ordered)
        );
        break;
      case "table":
        if ("header" in token && "rows" in token) {
          paragraphs.push(tableToXml(token as Tokens.Table));
        }
        break;
      case "hr":
        paragraphs.push(
          `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>`
        );
        break;
      case "space":
        // Skip empty tokens
        break;
      default:
        // Fallback: treat as plain text
        if ("text" in token && typeof token.text === "string") {
          paragraphs.push(
            `<w:p>${inlineToRuns(token.text)}</w:p>`
          );
        }
        break;
    }
  }

  return paragraphs;
}

// ─── パブリック API ───

/**
 * MarkdownからWord (.docx) バイナリを生成する。
 * @returns Blob (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
 */
export async function generateDocx(markdownContent: string): Promise<Blob> {
  const bodyContent = markdownToOoxml(markdownContent).join("\n");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="720" w:footer="720"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", ROOT_RELS);
  zip.file("word/_rels/document.xml.rels", WORD_RELS);
  zip.file("word/document.xml", documentXml);
  zip.file("word/styles.xml", STYLES_XML);
  zip.file("word/numbering.xml", NUMBERING_XML);

  return await zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
