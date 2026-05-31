import { ExtractedPdfPage, TranslationChunk } from "@/lib/types";

const MAX_CHUNK_LENGTH = 1200;

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

const mergeParagraphs = (paragraphs: string[]): string[] => {
  const chunks: string[] = [];
  let buffer = "";

  for (const paragraph of paragraphs) {
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
    originalChinese: paragraph,
    translatedEnglish: ""
  }));
};

export const createChunksFromPdfPages = (pages: ExtractedPdfPage[]): TranslationChunk[] => {
  const chunks: TranslationChunk[] = [];

  for (const page of pages) {
    const pageParagraphs = mergeParagraphs(splitParagraphs(page.text));
    pageParagraphs.forEach((paragraph, index) => {
      chunks.push({
        id: `pdf-p${page.pageNumber}-${index + 1}`,
        pageNumber: page.pageNumber,
        originalChinese: paragraph,
        translatedEnglish: ""
      });
    });
  }

  return chunks;
};

export const joinEnglishTranslation = (chunks: TranslationChunk[]): string =>
  chunks
    .map((chunk) => chunk.translatedEnglish.trim())
    .filter(Boolean)
    .join("\n\n");
