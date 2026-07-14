"use client";

import ChineseSourceBody from "@/components/ChineseSourceBody";
import { DocumentFormat, ExtractedPdfPage, TranslationPage } from "@/lib/types";

type DocumentSourceViewProps = {
  pages: ExtractedPdfPage[];
  translationPages?: TranslationPage[];
  format: DocumentFormat;
  fontSize: number;
  readingWidthClass: string;
};

const FORMAT_LABELS: Record<DocumentFormat, string> = {
  pdf: "PDF",
  docx: "DOCX",
  epub: "EPUB",
  pptx: "PowerPoint"
};

const UNIT_LABELS: Record<DocumentFormat, string> = {
  pdf: "Page",
  docx: "Section",
  epub: "Chapter",
  pptx: "Slide"
};

export default function DocumentSourceView({
  pages,
  translationPages = [],
  format,
  fontSize,
  readingWidthClass
}: DocumentSourceViewProps) {
  return (
    <div className="space-y-4">
      {pages.map((page) => {
        const savedPage = translationPages.find((entry) => entry.pageNumber === page.pageNumber);
        const originalText = page.text.trim() || savedPage?.originalText.trim() || "";

        return (
          <article
            key={`source-unit-${page.pageNumber}`}
            className={`reader-card mx-auto w-full ${readingWidthClass} p-5 sm:p-6`}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="eyebrow">
                {FORMAT_LABELS[format]} · {UNIT_LABELS[format]} {page.pageNumber}
              </p>
              {format === "pdf" && !page.text.trim() ? (
                <span className="status-pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                  OCR text
                </span>
              ) : null}
            </div>
            <div className="text-slate-800 dark:text-slate-100" style={{ fontSize: `${fontSize}px` }}>
              {originalText ? (
                <ChineseSourceBody text={originalText} />
              ) : (
                <p className="cn-text text-sm text-slate-500 dark:text-slate-400">
                  No readable text was detected in this {UNIT_LABELS[format].toLowerCase()}.
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
