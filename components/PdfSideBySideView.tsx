"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChineseSourceBody from "@/components/ChineseSourceBody";
import SearchHighlightedText from "@/components/SearchHighlightedText";
import StructuredTranslationBody from "@/components/StructuredTranslationBody";
import { BilingualSearchControls, PageJumpControl } from "@/components/ViewerNavigation";
import { createDocumentSearchMatches, normalizeDocumentSearchQuery } from "@/lib/documentSearch";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const sourcePaneRef = useRef<HTMLDivElement | null>(null);
  const translationPaneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCurrentPage(1);
    setZoom("fit-width");
    setSourceDisplay("pdf");
    setSearchQuery("");
    setActiveSearchIndex(-1);
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
    translationPages.forEach((page) => {
      if (!map.get(page.pageNumber)?.trim() && page.originalText.trim()) {
        map.set(page.pageNumber, page.originalText);
      }
    });
    return map;
  }, [extractedPages, translationPages]);

  const currentTranslation = pageTranslationMap.get(currentPage);
  const fallbackChineseText = pageTextMap.get(currentPage) || "";
  const effectivePageCount = Math.max(totalPages, 1);
  const hashZoom = zoom === "fit-width" ? "page-width" : zoom;
  const viewerSrc = `${pdfUrl}#page=${currentPage}&zoom=${hashZoom}`;
  const parsedTranslation = parseTranslationText(currentTranslation?.translatedText || "");
  const translatedCount = translationPages.filter((page) => page.translatedText.trim()).length;
  const ocrReadyCount = extractedPages.filter((page) => !page.text.trim()).length;
  const currentPageNeedsOcr = !extractedPages.find((page) => page.pageNumber === currentPage)?.text.trim();
  const nextUntranslatedPage = pageOptions.find((option) => !pageTranslationMap.get(option.value)?.translatedText?.trim());
  const canShowTextSource = Boolean(fallbackChineseText.trim());
  const showTextSource = sourceDisplay === "text" && canShowTextSource;
  const normalizedSearchQuery = normalizeDocumentSearchQuery(searchQuery);
  const searchMatches = useMemo(
    () => pageOptions.flatMap((option) => [
      ...createDocumentSearchMatches(option.value, "source", pageTextMap.get(option.value) || "", normalizedSearchQuery),
      ...createDocumentSearchMatches(
        option.value,
        "translation",
        pageTranslationMap.get(option.value)?.translatedText || "",
        normalizedSearchQuery
      )
    ]),
    [normalizedSearchQuery, pageOptions, pageTextMap, pageTranslationMap]
  );
  const activeSearchMatch = activeSearchIndex >= 0 ? searchMatches[activeSearchIndex] : undefined;
  const activeSearchLabel = activeSearchMatch
    ? `${activeSearchMatch.side === "source" ? "Chinese" : "English"} · Page ${activeSearchMatch.pageNumber}`
    : undefined;

  useEffect(() => {
    if (!canShowTextSource && sourceDisplay === "text") {
      setSourceDisplay("pdf");
    }
  }, [canShowTextSource, sourceDisplay]);

  useEffect(() => {
    sourcePaneRef.current?.scrollTo({ top: 0 });
    translationPaneRef.current?.scrollTo({ top: 0 });
  }, [currentPage, sourceDisplay]);

  useEffect(() => {
    if (!activeSearchMatch) {
      return;
    }
    setCurrentPage(activeSearchMatch.pageNumber);
    if (activeSearchMatch.side === "source" && pageTextMap.get(activeSearchMatch.pageNumber)?.trim()) {
      setSourceDisplay("text");
    }
  }, [activeSearchMatch, pageTextMap]);

  useEffect(() => {
    const panes = [sourcePaneRef.current, translationPaneRef.current];
    panes.forEach((pane) => {
      pane?.querySelectorAll("mark[data-search-match]").forEach((mark) => {
        mark.classList.remove("search-highlight-active");
      });
    });
    if (!activeSearchMatch || activeSearchMatch.pageNumber !== currentPage) {
      return;
    }

    const activePane = activeSearchMatch.side === "source" ? sourcePaneRef.current : translationPaneRef.current;
    const frame = window.requestAnimationFrame(() => {
      const marks = activePane?.querySelectorAll<HTMLElement>("mark[data-search-match]");
      const activeMark = marks?.[activeSearchMatch.occurrence];
      if (activeMark) {
        activeMark.classList.add("search-highlight-active");
        activeMark.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSearchMatch, currentPage, showTextSource]);

  const handlePageChange = (pageNumber: number) => {
    const safePage = Math.max(1, Math.min(effectivePageCount, pageNumber));
    setCurrentPage(safePage);
    if (normalizedSearchQuery) {
      setActiveSearchIndex(searchMatches.findIndex((match) => match.pageNumber === safePage));
    }
  };
  const handlePrev = () => handlePageChange(currentPage - 1);
  const handleNext = () => handlePageChange(currentPage + 1);
  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    setActiveSearchIndex(query.trim() ? 0 : -1);
  };
  const moveSearch = (direction: -1 | 1) => {
    if (searchMatches.length === 0) {
      return;
    }
    setActiveSearchIndex((currentIndex) => {
      if (currentIndex < 0) {
        return direction === 1 ? 0 : searchMatches.length - 1;
      }
      return (currentIndex + direction + searchMatches.length) % searchMatches.length;
    });
  };

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
      <div className="sticky top-4 z-10 rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentPage <= 1}
            className="secondary-button h-8 px-2.5 text-xs"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={currentPage >= effectivePageCount}
            className="secondary-button h-8 px-2.5 text-xs"
          >
            Next
          </button>
          <PageJumpControl currentPage={currentPage} totalPages={effectivePageCount} onPageChange={handlePageChange} />
          <span className="status-pill">{translatedCount} translated</span>
          {ocrReadyCount > 0 ? (
            <span className="status-pill bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
              {ocrReadyCount} OCR page{ocrReadyCount === 1 ? "" : "s"}
            </span>
          ) : null}

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {nextUntranslatedPage ? (
              <button
                type="button"
                onClick={() => handlePageChange(nextUntranslatedPage.value)}
                className="secondary-button h-8 px-2.5 text-xs"
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
            <button type="button" onClick={zoomOut} disabled={showTextSource} className="icon-button h-8 w-8" title="Zoom out">
              -
            </button>
            <button type="button" onClick={zoomIn} disabled={showTextSource} className="icon-button h-8 w-8" title="Zoom in">
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom("fit-width")}
              disabled={showTextSource}
              className="secondary-button h-8 px-2.5 text-xs"
            >
              Fit
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {zoom === "fit-width" ? "Fit width" : `${zoom}%`}
            </span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-800">
          <BilingualSearchControls
            query={searchQuery}
            resultCount={searchMatches.length}
            activeResultIndex={activeSearchIndex}
            activeResultLabel={activeSearchLabel}
            onQueryChange={handleSearchQueryChange}
            onPrevious={() => moveSearch(-1)}
            onNext={() => moveSearch(1)}
          />
          {normalizedSearchQuery ? (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Chinese matches open the readable Text view.</span>
          ) : null}
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
                <ChineseSourceBody text={fallbackChineseText} compact highlightQuery={normalizedSearchQuery} />
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
                  <ChineseSourceBody text={fallbackChineseText} compact highlightQuery={normalizedSearchQuery} />
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
                <StructuredTranslationBody paragraphs={parsedTranslation.bodyParagraphs} compact highlightQuery={normalizedSearchQuery} />

                {parsedTranslation.footnotes.length > 0 ? (
                  <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70">
                    <p className="eyebrow mb-3">Footnotes</p>
                    <ol className="space-y-2">
                      {parsedTranslation.footnotes.map((note) => (
                        <li key={`${note.marker}-${note.content.slice(0, 24)}`} className="text-sm leading-7 text-slate-700 dark:text-slate-200">
                          <span className="mr-2 font-semibold text-slate-900 dark:text-slate-100">
                            <SearchHighlightedText text={note.marker} query={normalizedSearchQuery} />
                          </span>
                          <span><SearchHighlightedText text={note.content} query={normalizedSearchQuery} /></span>
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
