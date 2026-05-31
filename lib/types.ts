export type ThemePreference = "light" | "dark" | "system";

export type TranslationChunk = {
  id: string;
  pageNumber?: number;
  originalChinese: string;
  translatedEnglish: string;
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
    }
  | {
      kind: "scanned";
      message: string;
    }
  | {
      kind: "error";
      message: string;
    };
