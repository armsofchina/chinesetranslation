export type ThemePreference = "light" | "dark" | "system";

export type DocumentFormat = "pdf" | "docx" | "epub" | "pptx";

export type TranslationChunk = {
  id: string;
  pageNumber: number;
  originalChinese: string;
  translatedEnglish: string;
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
