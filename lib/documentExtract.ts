import { cleanExtractedChineseText } from "@/lib/chineseTextCleanup";
import { DocumentFormat, ExtractedPdfPage, StructuredDocumentExtractResult } from "@/lib/types";

const MIME_FORMATS: Record<string, DocumentFormat> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/epub+zip": "epub",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx"
};

const EXTENSION_FORMATS: Record<string, DocumentFormat> = {
  pdf: "pdf",
  docx: "docx",
  epub: "epub",
  pptx: "pptx"
};

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "br",
  "div",
  "figcaption",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "p",
  "section",
  "table",
  "td",
  "th",
  "tr"
]);

const normalizeZipPath = (path: string): string => {
  const parts: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
};

const resolveZipPath = (baseFile: string, relativePath: string): string => {
  const baseDirectory = baseFile.includes("/") ? baseFile.slice(0, baseFile.lastIndexOf("/") + 1) : "";
  const withoutFragment = relativePath.split("#")[0];
  let decoded = withoutFragment;
  try {
    decoded = decodeURIComponent(withoutFragment);
  } catch {
    decoded = withoutFragment;
  }
  return normalizeZipPath(`${baseDirectory}${decoded}`);
};

const parseXml = (xml: string, type: DOMParserSupportedType = "application/xml"): Document => {
  const document = new DOMParser().parseFromString(xml, type);
  if (document.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Invalid XML document.");
  }
  return document;
};

const collectElementText = (element: Element): string => {
  const parts: string[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === 3) {
      parts.push(node.nodeValue || "");
      return;
    }
    if (node.nodeType !== 1) {
      return;
    }
    const childElement = node as Element;
    const tagName = childElement.localName.toLowerCase();
    if (tagName === "tab") {
      parts.push("\t");
      return;
    }
    if (tagName === "br" || tagName === "cr") {
      parts.push("\n");
      return;
    }
    for (const child of Array.from(node.childNodes)) {
      visit(child);
    }
  };
  visit(element);
  return parts.join("");
};

const collectHtmlText = (element: Element): string => {
  const parts: string[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === 3) {
      parts.push(node.nodeValue || "");
      return;
    }
    if (node.nodeType !== 1) {
      return;
    }
    const childElement = node as Element;
    const tagName = childElement.localName.toLowerCase();
    if (tagName === "script" || tagName === "style" || tagName === "svg") {
      return;
    }
    if (/^h[1-6]$/.test(tagName)) {
      parts.push(`\n${"#".repeat(Number(tagName[1]))} `);
    } else if (tagName === "li") {
      parts.push("\n- ");
    } else if (tagName === "tr") {
      parts.push("\n");
    } else if (tagName === "td" || tagName === "th") {
      if (parts.length && !parts[parts.length - 1].endsWith("\n")) parts.push("\t");
    } else if (BLOCK_TAGS.has(tagName)) {
      parts.push("\n");
    }
    for (const child of Array.from(node.childNodes)) {
      visit(child);
    }
    if (tagName !== "td" && tagName !== "th" && BLOCK_TAGS.has(tagName)) {
      parts.push("\n");
    }
  };
  visit(element);
  return parts.join("");
};

const normalizeExtractedText = (text: string): string =>
  cleanExtractedChineseText(
    text
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
  );

const groupTextBlocks = (blocks: string[], maxCharacters = 12_000): string[] => {
  const groups: string[] = [];
  let buffer = "";

  for (const rawBlock of blocks) {
    const block = normalizeExtractedText(rawBlock);
    if (!block) {
      continue;
    }
    if (buffer && buffer.length + block.length + 2 > maxCharacters) {
      groups.push(buffer);
      buffer = block;
    } else {
      buffer = buffer ? `${buffer}\n\n${block}` : block;
    }
  }

  if (buffer) {
    groups.push(buffer);
  }
  return groups;
};

const toPages = (texts: string[], pageNumbers?: number[]): ExtractedPdfPage[] =>
  texts
    .map((text, index) => ({
      pageNumber: pageNumbers?.[index] ?? index + 1,
      text: normalizeExtractedText(text)
    }))
    .filter((page) => Boolean(page.text));

const getWordAttribute = (element: Element | null | undefined, name: string): string =>
  element?.getAttribute(`w:${name}`) || element?.getAttribute(name) || "";

const formatWordParagraph = (paragraph: Element): string => {
  const text = collectElementText(paragraph).trim();
  if (!text) return "";
  const properties = Array.from(paragraph.children).find((child) => child.localName === "pPr");
  const styleElement = properties ? Array.from(properties.children).find((child) => child.localName === "pStyle") : undefined;
  const style = getWordAttribute(styleElement, "val").toLowerCase();
  const headingMatch = style.match(/(?:heading|標題|标题)\s*([1-6])?/i);
  if (headingMatch) return `${"#".repeat(Number(headingMatch[1] || 1))} ${text}`;
  const isList = Boolean(properties && Array.from(properties.children).some((child) => child.localName === "numPr"));
  return isList ? `- ${text}` : text;
};

const formatWordTable = (table: Element): string =>
  Array.from(table.children)
    .filter((child) => child.localName === "tr")
    .map((row) => Array.from(row.children)
      .filter((child) => child.localName === "tc")
      .map((cell) => Array.from(cell.getElementsByTagName("w:p")).map(collectElementText).filter(Boolean).join(" "))
      .join("\t"))
    .filter(Boolean)
    .join("\n");

const extractDocx = async (zip: import("jszip")): Promise<StructuredDocumentExtractResult> => {
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) {
    return { kind: "error", message: "This DOCX does not contain a readable Word document." };
  }

  const document = parseXml(await documentFile.async("string"));
  const body = document.getElementsByTagName("w:body")[0];
  if (!body) {
    return { kind: "error", message: "This DOCX does not contain a readable document body." };
  }
  const blocks = Array.from(body.children).map((element) => {
    if (element.localName === "p") return formatWordParagraph(element);
    if (element.localName === "tbl") return formatWordTable(element);
    return "";
  });
  const sections = groupTextBlocks(blocks);
  if (sections.length === 0) {
    return { kind: "error", message: "No readable text was found in this DOCX file." };
  }
  return { kind: "success", pages: toPages(sections), totalPages: sections.length };
};

const extractEpub = async (zip: import("jszip")): Promise<StructuredDocumentExtractResult> => {
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) {
    return { kind: "error", message: "This EPUB is missing its package information." };
  }

  const container = parseXml(await containerFile.async("string"));
  const rootFile = container.getElementsByTagName("rootfile")[0]?.getAttribute("full-path");
  if (!rootFile) {
    return { kind: "error", message: "This EPUB does not declare a readable content package." };
  }

  const packagePath = normalizeZipPath(rootFile);
  const packageFile = zip.file(packagePath);
  if (!packageFile) {
    return { kind: "error", message: "The EPUB content package could not be opened." };
  }

  const packageDocument = parseXml(await packageFile.async("string"));
  const manifest = new Map<string, string>();
  for (const item of Array.from(packageDocument.getElementsByTagName("item"))) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) {
      manifest.set(id, resolveZipPath(packagePath, href));
    }
  }

  const chapterTexts: string[] = [];
  for (const itemRef of Array.from(packageDocument.getElementsByTagName("itemref"))) {
    const id = itemRef.getAttribute("idref");
    const contentPath = id ? manifest.get(id) : undefined;
    const contentFile = contentPath ? zip.file(contentPath) : null;
    if (!contentFile) {
      continue;
    }
    const markup = await contentFile.async("string");
    let contentDocument: Document;
    try {
      contentDocument = parseXml(markup, "application/xhtml+xml");
    } catch {
      contentDocument = new DOMParser().parseFromString(markup, "text/html");
    }
    const body = contentDocument.getElementsByTagName("body")[0] || contentDocument.documentElement;
    const text = normalizeExtractedText(collectHtmlText(body));
    if (text) {
      chapterTexts.push(text);
    }
  }

  if (chapterTexts.length === 0) {
    return { kind: "error", message: "No readable text was found in this EPUB. DRM-protected books are not supported." };
  }
  return { kind: "success", pages: toPages(chapterTexts), totalPages: chapterTexts.length };
};

const extractPptx = async (zip: import("jszip")): Promise<StructuredDocumentExtractResult> => {
  const presentationFile = zip.file("ppt/presentation.xml");
  const relationshipsFile = zip.file("ppt/_rels/presentation.xml.rels");
  if (!presentationFile || !relationshipsFile) {
    return { kind: "error", message: "This PPTX does not contain a readable presentation." };
  }

  const presentation = parseXml(await presentationFile.async("string"));
  const relationships = parseXml(await relationshipsFile.async("string"));
  const targets = new Map<string, string>();
  for (const relationship of Array.from(relationships.getElementsByTagName("Relationship"))) {
    const id = relationship.getAttribute("Id");
    const target = relationship.getAttribute("Target");
    if (id && target) {
      targets.set(id, resolveZipPath("ppt/presentation.xml", target));
    }
  }

  const slideTexts: string[] = [];
  const slideNumbers: number[] = [];
  const slideIds = Array.from(presentation.getElementsByTagName("p:sldId"));
  for (let index = 0; index < slideIds.length; index += 1) {
    const relationshipId = slideIds[index].getAttribute("r:id");
    const slidePath = relationshipId ? targets.get(relationshipId) : undefined;
    const slideFile = slidePath ? zip.file(slidePath) : null;
    if (!slideFile) {
      continue;
    }
    const slide = parseXml(await slideFile.async("string"));
    const paragraphs = Array.from(slide.getElementsByTagName("a:p")).map((paragraph) => {
      const text = collectElementText(paragraph).trim();
      const properties = Array.from(paragraph.children).find((child) => child.localName === "pPr");
      const bullet = properties && Array.from(properties.children).some((child) => child.localName === "buChar" || child.localName === "buAutoNum");
      return bullet && text ? `- ${text}` : text;
    });
    const text = normalizeExtractedText(paragraphs.filter(Boolean).join("\n"));
    if (text) {
      slideTexts.push(text);
      slideNumbers.push(index + 1);
    }
  }

  if (slideTexts.length === 0) {
    return { kind: "error", message: "No readable text was found in this PPTX file." };
  }
  return { kind: "success", pages: toPages(slideTexts, slideNumbers), totalPages: slideIds.length };
};

export const getDocumentFormat = (file: File): DocumentFormat | undefined => {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  return MIME_FORMATS[file.type] || EXTENSION_FORMATS[extension];
};

export const extractStructuredDocument = async (
  file: File,
  format: Exclude<DocumentFormat, "pdf">
): Promise<StructuredDocumentExtractResult> => {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    if (format === "docx") {
      return extractDocx(zip);
    }
    if (format === "epub") {
      return extractEpub(zip);
    }
    return extractPptx(zip);
  } catch {
    return { kind: "error", message: `Unable to extract text from this ${format.toUpperCase()} file.` };
  }
};
