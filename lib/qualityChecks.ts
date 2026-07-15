import { TranslationChunk } from "@/lib/types";
import { buildSegmentQaReport } from "@/lib/segmentQa";

export type TranslationQualityIssue = {
  id: string;
  chunkId: string;
  pageNumber: number;
  severity: "error" | "warning";
  code: "empty" | "numbers" | "source-leak" | "glossary" | "length";
  message: string;
};

export const inspectTranslationQuality = (
  chunks: TranslationChunk[],
  glossary: Record<string, string>
): TranslationQualityIssue[] => {
  const issues: TranslationQualityIssue[] = [];

  for (const chunk of chunks) {
    const issueBase = `${chunk.id}-`;
    const report = chunk.qa ?? buildSegmentQaReport(chunk, chunk.translatedEnglish, glossary);
    report.warnings.forEach((warning, index) => {
      issues.push({
        id: `${issueBase}${warning.code}-${index}`,
        chunkId: chunk.id,
        pageNumber: chunk.pageNumber,
        severity: warning.severity,
        code: warning.code,
        message: warning.message
      });
    });
  }

  return issues;
};
