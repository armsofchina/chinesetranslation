export type ParsedFootnote = {
  marker: string;
  content: string;
};

export type ParsedTranslation = {
  bodyParagraphs: string[];
  footnotes: ParsedFootnote[];
};

const FOOTNOTE_MARKER_RE =
  /^(\[(\d{1,3})\]|\((\d{1,3})\)|(\d{1,3})[.)]|([*†‡]))\s+(.+)$/;
const FOOTNOTE_HEADING_RE = /\n{1,2}footnotes?\s*\n/i;

const normalizeInput = (text: string): string =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const splitParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);

const findFootnoteStart = (paragraphs: string[]): number => {
  if (paragraphs.length < 3) {
    return -1;
  }

  const candidateIndexes: number[] = [];
  paragraphs.forEach((paragraph, index) => {
    if (FOOTNOTE_MARKER_RE.test(paragraph)) {
      candidateIndexes.push(index);
    }
  });

  if (candidateIndexes.length < 2) {
    return -1;
  }

  const firstCandidate = candidateIndexes[0];
  const isNearEnd = firstCandidate >= Math.floor(paragraphs.length * 0.45);
  if (!isNearEnd) {
    return -1;
  }

  const contiguousCandidates = candidateIndexes.filter(
    (index, idx) => idx === 0 || index === candidateIndexes[idx - 1] + 1
  );
  if (contiguousCandidates.length < 2) {
    return -1;
  }

  return firstCandidate;
};

const parseFootnoteParagraphs = (footnoteParagraphs: string[]): ParsedFootnote[] => {
  const parsed: ParsedFootnote[] = [];

  footnoteParagraphs.forEach((paragraph) => {
    const match = paragraph.match(FOOTNOTE_MARKER_RE);
    if (match) {
      parsed.push({
        marker: match[1],
        content: match[6].trim()
      });
      return;
    }

    if (parsed.length > 0) {
      parsed[parsed.length - 1].content = `${parsed[parsed.length - 1].content} ${paragraph}`.trim();
    }
  });

  return parsed;
};

const parseFootnoteLines = (footnoteText: string): ParsedFootnote[] => {
  const parsed: ParsedFootnote[] = [];
  const lines = footnoteText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  lines.forEach((line) => {
    const match = line.match(FOOTNOTE_MARKER_RE);
    if (match) {
      parsed.push({
        marker: match[1],
        content: match[6].trim()
      });
      return;
    }

    if (parsed.length > 0) {
      parsed[parsed.length - 1].content = `${parsed[parsed.length - 1].content} ${line}`.trim();
    }
  });

  return parsed;
};

export const parseTranslationText = (text: string): ParsedTranslation => {
  const normalized = normalizeInput(text);
  if (!normalized) {
    return { bodyParagraphs: [], footnotes: [] };
  }

  const headingMatch = normalized.match(FOOTNOTE_HEADING_RE);
  if (headingMatch && headingMatch.index !== undefined) {
    const bodyPart = normalized.slice(0, headingMatch.index).trim();
    const footnotePart = normalized.slice(headingMatch.index + headingMatch[0].length).trim();
    const footnotes = parseFootnoteLines(footnotePart);
    return {
      bodyParagraphs: splitParagraphs(bodyPart),
      footnotes
    };
  }

  const paragraphs = splitParagraphs(normalized);
  const footnoteStart = findFootnoteStart(paragraphs);
  if (footnoteStart === -1) {
    return {
      bodyParagraphs: paragraphs,
      footnotes: []
    };
  }

  const bodyParagraphs = paragraphs.slice(0, footnoteStart);
  const footnoteParagraphs = paragraphs.slice(footnoteStart);
  const footnotes = parseFootnoteParagraphs(footnoteParagraphs);

  if (footnotes.length < 2) {
    return {
      bodyParagraphs: paragraphs,
      footnotes: []
    };
  }

  return { bodyParagraphs, footnotes };
};

export const normalizeTranslationFootnotes = (text: string): string => {
  const parsed = parseTranslationText(text);
  if (parsed.bodyParagraphs.length === 0 && parsed.footnotes.length === 0) {
    return text.trim();
  }

  if (parsed.footnotes.length === 0) {
    return parsed.bodyParagraphs.join("\n\n").trim();
  }

  const footnoteLines = parsed.footnotes.map((note) => `${note.marker} ${note.content}`);
  const body = parsed.bodyParagraphs.join("\n\n").trim();
  return `${body}\n\nFootnotes\n${footnoteLines.join("\n")}`.trim();
};
