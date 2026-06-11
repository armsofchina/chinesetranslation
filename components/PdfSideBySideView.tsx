"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChineseSourceBody from "@/components/ChineseSourceBody";
import StructuredTranslationBody from "@/components/StructuredTranslationBody";
import { parseTranslationText } from "@/lib/footnotes";
import { ExtractedPdfPage, TranslationPage } from "@/lib/types";

type PdfSideBySideViewProps = {
  pdfUrl: string;
  totalPages: number;
  extractedPages: ExtractedPdfPage[];
  translationPages: TranslationPage[];
  scannedMessage?: string;
};

type ZoomValue = number | "fit-width";
type SourceDisplay = "pdf" | "text";

const MIN_ZOOM = 60;
const MAX_ZOOM = 240;
const ZOOM_STEP = 20;

const clampZoom = (value: number): number => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));

export default function PdfSideBySideView({
  pdfUrl,
  totalPages,
  extractedPages,
  translationPages,
  scannedMessage
}: PdfSideBySideViewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState<ZoomValue>("fit-width");
  const [pdfViewerFailed, setPdfViewerFailed] = useState(false);
  const [sourceDisplay, setSourceDisplay] = useState<SourceDisplay>("pdf");
  const sourcePaneRef = useRef<HTMLDivElement | null>(null);
  const translationPaneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCurrentPage(1);
    setZoom("fit-width");
    setSourceDisplay("pdf");
    setPdfViewerFailed(typeof navigator !== "undefined" && navigator.pdfViewerEnabled === false);
  }, [pdfUrl]);

  const pageOptions = useMemo(
    () =>
      Array.from({ length: Math.max(totalPages, 1) }, (_, index) => ({
        value: index + 1,
        label: `Page ${index + 1}`
      })),
    [totalPages]
  );

  const pageTranslationMap = useMemo(() => {
    const map = new Map<number, TranslationPage>();
    translationPages.forEach((page) => map.set(page.pageNumber, page));
    return map;
  }, [translationPages]);

  const pageTextMap = useMemo(() => {
    const map = new Map<number, string>();
    extractedPages.forEach((page) => map.set(page.pageNumber, page.text));
    return map;
  }, [extractedPages]);

  const currentTranslation = pageTranslationMap.get(currentPage);
  const fallbackChineseText = pageTextMap.get(currentPage) || "";
  const effectivePageCount = Math.max(totalPages, 1);
  const hashZoom = zoom === "fit-width" ? "page-width" : zoom;
  const viewerSrc = `${pdfUrl}#page=${currentPage}&zoom=${hashZoom}`;
  const parsedTranslation = parseTranslationText(currentTranslation?.translatedText || "");
  const translatedCount = translationPages.filter((page) => page.translatedText.trim()).length;
  const ocrReadyCount = extractedPages.filter((page) => !page.text.trim()).length;
  const currentPageNeedsOcr = !fallbackChineseText.trim();
  const nextUntranslatedPage = pageOptions.find((option) => !pageTranslationMap.get(option.value)?.translatedText?.trim());
  const canShowTextSource = Boolean(fallbackChineseText.trim());
  const showTextSource = sourceDisplay === "text" && canShowTextSource;

  useEffect(() => {
    if (!canShowTextSource && sourceDisplay === "text") {
      setSourceDisplay("pdf");
    }
  }, [canShowTextSource, sourceDisplay]);

  useEffect(() => {
    sourcePaneRef.current?.scrollTo({ top: 0 });
    translationPaneRef.current?.scrollTo({ top: 0 });
  }, [currentPage, sourceDisplay]);

  const handlePrev = () => setCurrentPage((prev) => Math.max(1, prev - 1));
  const handleNext = () => setCurrentPage((prev) => Math.min(effectivePageCount, prev + 1));

  const zoomIn = () => {
    setZoom((prev) => {
      if (prev === "fit-width") {
        return 120;
      }
      return clampZoom(prev + ZOOM_STEP);
    });
  };

  const zoomOut = () => {
    setZoom((prev) => {
      if (prev === "fit-width") {
        return 100;
      }
      return clampZoom(prev - ZOOM_STEP);
    });
  };

  return (
    <section className="space-y-3">
      <div className="sticky top-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentPage <= 1}
          className="secondary-button px-2.5 py-1.5 text-xs"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={currentPage >= effectivePageCount}
          className="secondary-button px-2.5 py-1.5 text-xs"
        >
          Next
        </button>

        <select
          id="pdf-page-select"
          value={currentPage}
          onChange={(event) => setCurrentPage(Number(event.target.value))}
          aria-label="PDF page"
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-sky-900"
        >
          {pageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <span className="text-xs text-slate-500 dark:text-slate-400">
          Page {currentPage} of {effectivePageCount}
        </span>
        <span className="status-pill">
          {translatedCount} translated
        </span>
        {ocrReadyCount > 0 ? (
          <span className="status-pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
            {ocrReadyCount} OCR page{ocrReadyCount === 1 ? "" : "s"}
          </span>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {nextUntranslatedPage ? (
            <button
              type="button"
              onClick={() => setCurrentPage(nextUntranslatedPage.value)}
              className="secondary-button px-2.5 py-1.5 text-xs"
            >
              Next empty
            </button>
          ) : null}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/60">
            <button
              type="button"
              onClick={() => setSourceDisplay("pdf")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                sourceDisplay === "pdf"
                  ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              PDF
            </button>
            <button
              type="button"
              onClick={() => setSourceDisplay("text")}
              disabled={!canShowTextSource}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                sourceDisplay === "text"
                  ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Text
            </button>
          </div>
          <button
            type="button"
            onClick={zoomOut}
            disabled={showTextSource}
            className="icon-button h-8 w-8"
            title="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={showTextSource}
            className="icon-button h-8 w-8"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom("fit-width")}
            disabled={showTextSource}
            className="secondary-button px-2.5 py-1.5 text-xs"
          >
            Fit
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {zoom === "fit-width" ? "Fit width" : `${zoom}%`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(420px,_0.95fr)_minmax(0,_1.05fr)] lg:items-start">
        <article className="reader-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="eyebrow">
              {showTextSource ? "Original Chinese Text" : "Original PDF"} • Page {currentPage}
            </p>
            {currentPageNeedsOcr ? (
              <span className="status-pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                OCR page
              </span>
            ) : (
              <span className="status-pill">
                Selectable text
              </span>
            )}
          </div>

          {showTextSource ? (
            <div
              ref={sourcePaneRef}
              className="h-[72vh] min-h-[560px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50 lg:h-[calc(100vh-15rem)] lg:max-h-[860px]"
            >
              <div className="text-sm text-slate-800 dark:text-slate-100">
                <ChineseSourceBody text={fallbackChineseText} compact />
              </div>
            </div>
          ) : pdfViewerFailed ? (
            <div
              ref={sourcePaneRef}
              className="h-[72vh] min-h-[560px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50 lg:h-[calc(100vh-15rem)] lg:max-h-[860px]"
            >
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Inline PDF viewing is unavailable in this browser. Showing extracted text fallback for this page.
              </p>
              <div className="mt-3 text-sm text-slate-800 dark:text-slate-100">
                {fallbackChineseText ? (
                  <ChineseSourceBody text={fallbackChineseText} compact />
                ) : (
                  <p className="cn-text text-sm text-slate-500 dark:text-slate-400">No selectable text found on this page.</p>
                )}
              </div>
            </div>
          ) : (
            <iframe
              src={viewerSrc}
              title={`PDF page ${currentPage}`}
              className="h-[72vh] min-h-[560px] w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800 lg:h-[calc(100vh-15rem)] lg:max-h-[860px]"
              onError={() => setPdfViewerFailed(true)}
            />
          )}
        </article>

        <article className="reader-card p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="eyebrow">
              English Translation • Page {currentPage}
            </p>
            {currentTranslation?.translatedText?.trim() ? (
              <span className="status-pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                Ready
              </span>
            ) : (
              <span className="status-pill bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                Pending
              </span>
            )}
          </div>

          <div
            ref={translationPaneRef}
            className="h-[72vh] min-h-[560px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50 lg:h-[calc(100vh-15rem)] lg:max-h-[860px]"
          >
            {currentTranslation?.translatedText?.trim() ? (
              <div
                className="document-text text-sm leading-8 text-slate-800 dark:text-slate-100"
                style={{ fontFamily: "var(--font-doc), Georgia, serif" }}
              >
                <StructuredTranslationBody paragraphs={parsedTranslation.bodyParagraphs} compact />

                {parsedTranslation.footnotes.length > 0 ? (
                  <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70">
                    <p className="eyebrow mb-3">Footnotes</p>
                    <ol className="space-y-2">
                      {parsedTranslation.footnotes.map((note) => (
                        <li key={`${note.marker}-${note.content.slice(0, 24)}`} className="text-sm leading-7 text-slate-700 dark:text-slate-200">
                          <span className="mr-2 font-semibold text-slate-900 dark:text-slate-100">{note.marker}</span>
                          <span>{note.content}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}
              </div>
            ) : scannedMessage ? (
              <p className="document-text rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                {scannedMessage}
              </p>
            ) : (
              <p className="document-text rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                No translated text is available for this page yet.
              </p>
            )}

            <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentPage <= 1}
                  className="secondary-button"
                >
                  Previous
                </button>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Page {currentPage} of {effectivePageCount}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentPage >= effectivePageCount}
                  className="secondary-button"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
