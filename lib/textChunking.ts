import { ExtractedPdfPage, TranslationChunk } from "@/lib/types";

const MAX_CHUNK_LENGTH = 1200;
const SENTENCE_END_RE = /(?<=[。！？!?；;])\s*/u;

const normalizeText = (text: string): string =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

const splitParagraphs = (text: string): string[] => {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const byBlankLine = normalized
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (byBlankLine.length > 1) {
    return byBlankLine;
  }

  return normalized
    .split(/\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
};

const splitOversizedParagraph = (paragraph: string): string[] => {
  if (paragraph.length <= MAX_CHUNK_LENGTH) {
    return [paragraph];
  }

  const sentences = paragraph
    .split(SENTENCE_END_RE)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const parts: string[] = [];
  let buffer = "";

  const pushHardSplit = (value: string) => {
    for (let start = 0; start < value.length; start += MAX_CHUNK_LENGTH) {
      parts.push(value.slice(start, start + MAX_CHUNK_LENGTH));
    }
  };

  for (const sentence of sentences) {
    if (sentence.length > MAX_CHUNK_LENGTH) {
      if (buffer) {
        parts.push(buffer);
        buffer = "";
      }
      pushHardSplit(sentence);
      continue;
    }

    if (!buffer) {
      buffer = sentence;
      continue;
    }

    if (buffer.length + sentence.length <= MAX_CHUNK_LENGTH) {
      buffer += sentence;
    } else {
      parts.push(buffer);
      buffer = sentence;
    }
  }

  if (buffer) {
    parts.push(buffer);
  }

  return parts;
};

const mergeParagraphs = (paragraphs: string[]): string[] => {
  const chunks: string[] = [];
  let buffer = "";

  for (const paragraph of paragraphs.flatMap(splitOversizedParagraph)) {
    if (!buffer) {
      buffer = paragraph;
      continue;
    }

    if (buffer.length + paragraph.length + 2 <= MAX_CHUNK_LENGTH) {
      buffer = `${buffer}\n\n${paragraph}`;
      continue;
    }

    chunks.push(buffer);
    buffer = paragraph;
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks;
};

export const createChunksFromPastedText = (text: string): TranslationChunk[] => {
  const merged = mergeParagraphs(splitParagraphs(text));

  return merged.map((paragraph, index) => ({
    id: `text-${index + 1}`,
    pageNumber: index + 1,
    originalChinese: paragraph,
    translatedEnglish: ""
  }));
};

export const createChunksFromPdfPages = (pages: ExtractedPdfPage[]): TranslationChunk[] => {
  const chunks: TranslationChunk[] = [];

  for (const page of pages) {
    chunks.push(...createChunksFromSinglePdfPage(page));
  }

  return chunks;
};

export const createChunksFromSinglePdfPage = (page: ExtractedPdfPage): TranslationChunk[] => {
  const pageParagraphs = mergeParagraphs(splitParagraphs(page.text));

  return pageParagraphs.map((paragraph, index) => ({
    id: `pdf-p${page.pageNumber}-${index + 1}`,
    pageNumber: page.pageNumber,
    originalChinese: paragraph,
    translatedEnglish: ""
  }));
};

export const joinEnglishTranslation = (chunks: TranslationChunk[]): string =>
  chunks
    .map((chunk) => chunk.translatedEnglish.trim())
    .filter(Boolean)
    .join("\n\n");
