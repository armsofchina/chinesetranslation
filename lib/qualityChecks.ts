import { TranslationChunk } from "@/lib/types";

export type TranslationQualityIssue = {
  id: string;
  chunkId: string;
  pageNumber: number;
  severity: "error" | "warning";
  code: "empty" | "numbers" | "source-leak" | "glossary" | "length";
  message: string;
};

const NUMBER_RE = /\d[\d,.:%/\-]*/g;
const HAN_RE = /\p{Script=Han}/gu;

const normalizeNumber = (value: string): string => value.replaceAll(",", "");

const extractNumbers = (text: string): string[] =>
  (text.match(NUMBER_RE) ?? []).map(normalizeNumber).sort();

const sameValues = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const inspectTranslationQuality = (
  chunks: TranslationChunk[],
  glossary: Record<string, string>
): TranslationQualityIssue[] => {
  const issues: TranslationQualityIssue[] = [];

  for (const chunk of chunks) {
    const source = chunk.originalChinese.trim();
    const target = chunk.translatedEnglish.trim();
    const issueBase = `${chunk.id}-`;

    if (!target) {
      issues.push({
        id: `${issueBase}empty`,
        chunkId: chunk.id,
        pageNumber: chunk.pageNumber,
        severity: "error",
        code: "empty",
        message: "This segment has no English translation."
      });
      continue;
    }

    if (!source.startsWith("[Image-based")) {
      const sourceNumbers = extractNumbers(source);
      const targetNumbers = extractNumbers(target);
      if (sourceNumbers.length > 0 && !sameValues(sourceNumbers, targetNumbers)) {
        issues.push({
          id: `${issueBase}numbers`,
          chunkId: chunk.id,
          pageNumber: chunk.pageNumber,
          severity: "error",
          code: "numbers",
          message: "Numbers, dates, or percentages may not match the source."
        });
      }

      const lengthRatio = target.length / Math.max(source.length, 1);
      if (source.length > 40 && (lengthRatio < 0.25 || lengthRatio > 6)) {
        issues.push({
          id: `${issueBase}length`,
          chunkId: chunk.id,
          pageNumber: chunk.pageNumber,
          severity: "warning",
          code: "length",
          message: "Translation length is unusual relative to the source."
        });
      }
    }

    const hanCount = target.match(HAN_RE)?.length ?? 0;
    if (hanCount >= 4 && hanCount / Math.max(target.length, 1) > 0.06) {
      issues.push({
        id: `${issueBase}source-leak`,
        chunkId: chunk.id,
        pageNumber: chunk.pageNumber,
        severity: "warning",
        code: "source-leak",
        message: "A noticeable amount of Chinese remains in the English output."
      });
    }

    for (const [chinese, english] of Object.entries(glossary)) {
      if (source.includes(chinese) && !target.toLocaleLowerCase().includes(english.toLocaleLowerCase())) {
        issues.push({
          id: `${issueBase}glossary-${chinese}`,
          chunkId: chunk.id,
          pageNumber: chunk.pageNumber,
          severity: "warning",
          code: "glossary",
          message: `Locked term “${chinese}” may not use “${english}”.`
        });
      }
    }
  }

  return issues;
};
