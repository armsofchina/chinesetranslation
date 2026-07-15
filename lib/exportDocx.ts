import { TranslationChunk } from "@/lib/types";

const escapeXml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const paragraphs = (text: string, language: string): string =>
  text
    .split(/\n+/)
    .map((paragraph) => `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:lang w:val="${language}"/></w:rPr><w:t xml:space="preserve">${escapeXml(paragraph)}</w:t></w:r></w:p>`)
    .join("");

export const downloadBilingualDocx = async (input: {
  chunks: TranslationChunk[];
  sourceLabel: string;
  model?: string;
}): Promise<void> => {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const rows = input.chunks.map((chunk) => `
    <w:tr>
      <w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>${paragraphs(chunk.originalChinese, "zh-CN")}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>${paragraphs(chunk.translatedEnglish, "en-US")}</w:tc>
    </w:tr>`).join("");
  const title = `${escapeXml(input.sourceLabel)}${input.model ? ` · ${escapeXml(input.model)}` : ""}`;

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>${title}</w:t></w:r></w:p>
        <w:tbl>
          <w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>
          <w:tr><w:tc>${paragraphs("Chinese source", "en-US")}</w:tc><w:tc>${paragraphs("English translation", "en-US")}</w:tc></w:tr>
          ${rows}
        </w:tbl>
        <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>
      </w:body>
    </w:document>`);

  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "bilingual-translation.docx";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};
