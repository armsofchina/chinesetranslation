import { parseStructuredBlocks, StructuredBlock } from "@/lib/structuredBlocks";

export type ChineseFootnote = {
  marker: string;
  content: string;
};

export type ParsedChineseSource = {
  blocks: StructuredBlock[];
  footnotes: ChineseFootnote[];
};

// Chinese-style footnote / annotation markers:
//   ① ② ③ ... (circled numbers), ⑴ ⑵ (parenthesized circled), ¹ ² ³ (superscript)
//   〔1〕 〈1〉 [1] (1) （1） 【1】 1. 1) 註1 注1 註一 注一 ※ *
const CIRCLED = "\\u2460-\\u24FF\\u2776-\\u277F";
const SUPERSCRIPT = "\\u00B9\\u00B2\\u00B3\\u2070-\\u2079";
const CN_NUM = "一二三四五六七八九十百零〇";

// A footnote line begins with a recognizable marker followed by content.
const CN_FOOTNOTE_LINE_RE = new RegExp(
  "^\\s*(" +
    `[${CIRCLED}]` + // ① ⑴
    "|" +
    `[${SUPERSCRIPT}]+` + // ¹²
    "|" +
    "[\\[〔〈［【(（]\\s*(?:\\d{1,3}|[" + CN_NUM + "]{1,3})\\s*[\\]〕〉］】)）]" + // [1] 〔1〕 （一）
    "|" +
    "(?:註|注|按|案)\\s*(?:\\d{1,3}|[" + CN_NUM + "]{1,3})" + // 註1 注一
    "|" +
    "\\d{1,3}\\s*[.、)）]" + // 1. 1、 1)
    "|" +
    "[※*＊]" + // ※ * ＊
    ")\\s*(.+)$"
);

// Heading that introduces a footnote/annotation section.
const CN_FOOTNOTE_HEADING_RE = /^[\s　]*(註釋|註解|注釋|注解|附註|附注|脚註|腳註|腳注|脚注|備註|备注|注|註|参考文献|參考文獻)[：:]?[\s　]*$/;

const HAN_RE = /\p{Script=Han}/u;

const splitLines = (text: string): string[] =>
  text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\u3000]+$/g, "").trimStart())
    .filter((line) => line.length > 0);

const splitParagraphs = (text: string): string[] =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * Detects a contiguous run of footnote lines at (or near) the end of the
 * document. Returns the index of the first footnote line, or -1 if none.
 */
const findFootnoteStart = (lines: string[]): number => {
  // Prefer an explicit heading (e.g. "註釋").
  for (let i = 0; i < lines.length; i += 1) {
    if (CN_FOOTNOTE_HEADING_RE.test(lines[i])) {
      // Footnote content begins on the next line.
      return i;
    }
  }

  // Otherwise look for >=2 contiguous footnote-marker lines in the last 60%.
  const minIndex = Math.floor(lines.length * 0.4);
  let runStart = -1;
  let runLength = 0;

  for (let i = 0; i < lines.length; i += 1) {
    if (CN_FOOTNOTE_LINE_RE.test(lines[i])) {
      if (runStart === -1) {
        runStart = i;
      }
      runLength += 1;
      if (runLength >= 2 && runStart >= minIndex) {
        return runStart;
      }
    } else {
      runStart = -1;
      runLength = 0;
    }
  }

  return -1;
};

const parseFootnoteLines = (lines: string[]): ChineseFootnote[] => {
  const notes: ChineseFootnote[] = [];

  for (const line of lines) {
    if (CN_FOOTNOTE_HEADING_RE.test(line)) {
      continue;
    }

    const match = line.match(CN_FOOTNOTE_LINE_RE);
    if (match) {
      notes.push({ marker: match[1].trim(), content: match[2].trim() });
      continue;
    }

    // Continuation line of the previous footnote.
    if (notes.length > 0) {
      notes[notes.length - 1].content = `${notes[notes.length - 1].content}${line}`.trim();
    }
  }

  return notes;
};

/**
 * Parses extracted Chinese source text into renderable structured blocks
 * (paragraphs, tables, charts) plus a separated footnote list, so it can be
 * displayed cleanly for a native reader.
 */
export const parseChineseSource = (text: string): ParsedChineseSource => {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return { blocks: [], footnotes: [] };
  }

  const lines = splitLines(trimmed);
  const footnoteStart = findFootnoteStart(lines);

  let bodyText = trimmed;
  let footnotes: ChineseFootnote[] = [];

  if (footnoteStart !== -1) {
    const bodyLines = lines.slice(0, footnoteStart);
    const footnoteLines = lines.slice(footnoteStart);
    const parsedNotes = parseFootnoteLines(footnoteLines);

    // Only treat as footnotes if we found at least one real note and there is
    // still body content remaining.
    if (parsedNotes.length >= 1 && bodyLines.length > 0) {
      bodyText = bodyLines.join("\n");
      footnotes = parsedNotes;
    }
  }

  const paragraphs = splitParagraphs(bodyText);
  const blocks = parseStructuredBlocks(paragraphs);

  return { blocks, footnotes };
};

/** True if the text contains any Han characters (used for font selection). */
export const containsHan = (text: string): boolean => HAN_RE.test(text || "");
