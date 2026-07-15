export type ThemePreference = "light" | "dark" | "system";

export type DocumentFormat = "pdf" | "docx" | "epub" | "pptx";

export type SegmentQaFact = {
  kind: "date" | "number" | "percentage" | "currency";
  source: string;
  normalized: string;
  matched: boolean;
};

export type SegmentQaTerm = {
  chinese: string;
  expectedEnglish: string;
  matched: boolean;
};

export type SegmentQaWarning = {
  code: "empty" | "numbers" | "source-leak" | "glossary" | "length";
  severity: "error" | "warning";
  message: string;
};

export type SegmentQaReport = {
  version: 1;
  segmentId: string;
  pageNumber: number;
  sourceCharacters: number;
  targetCharacters: number;
  residualHanCharacters: number;
  facts: SegmentQaFact[];
  terms: SegmentQaTerm[];
  warnings: SegmentQaWarning[];
};

export type TranslationChunk = {
  id: string;
  pageNumber: number;
  originalChinese: string;
  translatedEnglish: string;
  qa?: SegmentQaReport;
  reviewNote?: string;
  translationMemoryHit?: boolean;
};

export type TranslationPage = {
  pageNumber: number;
  originalText: string;
  translatedText: string;
  chunks: TranslationChunk[];
};

export type TranslateResponse = {
  chunks: TranslationChunk[];
  model: string;
};

export type ExtractedPdfPage = {
  pageNumber: number;
  text: string;
};

export type PdfExtractResult =
  | {
      kind: "success";
      pages: ExtractedPdfPage[];
      totalPages: number;
    }
  | {
      kind: "scanned";
      message: string;
      pages: ExtractedPdfPage[];
      totalPages: number;
    }
  | {
      kind: "error";
      message: string;
    };

export type StructuredDocumentExtractResult =
  | {
      kind: "success";
      pages: ExtractedPdfPage[];
      totalPages: number;
    }
  | {
      kind: "error";
      message: string;
    };

export type TranslateImageTask = {
  id: string;
  pageNumber: number;
  imageDataUrl: string;
  mode?: "ocr" | "translate";
};
