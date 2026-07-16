"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChineseSourceBody from "@/components/ChineseSourceBody";
import SearchHighlightedText from "@/components/SearchHighlightedText";
import StructuredTranslationBody from "@/components/StructuredTranslationBody";
import { BilingualSearchControls, PageJumpControl } from "@/components/ViewerNavigation";
import { createDocumentSearchMatches, normalizeDocumentSearchQuery } from "@/lib/documentSearch";
import { parseTranslationText } from "@/lib/footnotes";
import { TranslationChunk } from "@/lib/types";

type SideBySideViewProps = {
  chunks: TranslationChunk[];
  unitLabel?: string;
};

type ChunkGroup = {
  pageNumber: number;
  chunks: TranslationChunk[];
  originalText: string;
  translatedText: string;
};

export default function SideBySideView({ chunks, unitLabel = "Section" }: SideBySideViewProps) {
  const groupedChunks = useMemo<ChunkGroup[]>(() => {
    const groups = new Map<number, TranslationChunk[]>();
    chunks.forEach((chunk) => {
      groups.set(chunk.pageNumber, [...(groups.get(chunk.pageNumber) || []), chunk]);
    });
    return Array.from(groups.entries())
      .sort(([left], [right]) => left - right)
      .map(([pageNumber, pageChunks]) => ({
        pageNumber,
        chunks: pageChunks,
        originalText: pageChunks.map((chunk) => chunk.originalChinese).join("\n\n"),
        translatedText: pageChunks.map((chunk) => chunk.translatedEnglish).join("\n\n")
      }));
  }, [chunks]);
  const firstPage = groupedChunks[0]?.pageNumber || 1;
  const lastPage = groupedChunks.at(-1)?.pageNumber || firstPage;
  const [currentPage, setCurrentPage] = useState(firstPage);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const normalizedSearchQuery = normalizeDocumentSearchQuery(searchQuery);
  const searchMatches = useMemo(
    () => groupedChunks.flatMap((group) => [
      ...createDocumentSearchMatches(group.pageNumber, "source", group.originalText, normalizedSearchQuery),
      ...createDocumentSearchMatches(group.pageNumber, "translation", group.translatedText, normalizedSearchQuery)
    ]),
    [groupedChunks, normalizedSearchQuery]
  );
  const activeSearchMatch = activeSearchIndex >= 0 ? searchMatches[activeSearchIndex] : undefined;
  const activeSearchLabel = activeSearchMatch
    ? `${activeSearchMatch.side === "source" ? "Chinese" : "English"} · ${unitLabel} ${activeSearchMatch.pageNumber}`
    : undefined;

  useEffect(() => {
    if (!groupedChunks.some((group) => group.pageNumber === currentPage)) {
      setCurrentPage(firstPage);
    }
  }, [currentPage, firstPage, groupedChunks]);

  const scrollToPage = (requestedPage: number, behavior: ScrollBehavior = "smooth") => {
    const nearestPage = groupedChunks.reduce(
      (nearest, group) => Math.abs(group.pageNumber - requestedPage) < Math.abs(nearest - requestedPage)
        ? group.pageNumber
        : nearest,
      firstPage
    );
    setCurrentPage(nearestPage);
    const target = viewerRef.current?.querySelector<HTMLElement>(`[data-viewer-page="${nearestPage}"]`);
    target?.scrollIntoView({ behavior, block: "start" });
    if (normalizedSearchQuery) {
      setActiveSearchIndex(searchMatches.findIndex((match) => match.pageNumber === nearestPage));
    }
  };

  useEffect(() => {
    const viewer = viewerRef.current;
    viewer?.querySelectorAll("mark[data-search-match]").forEach((mark) => {
      mark.classList.remove("search-highlight-active");
    });
    if (!activeSearchMatch) {
      return;
    }

    setCurrentPage(activeSearchMatch.pageNumber);
    const frame = window.requestAnimationFrame(() => {
      const page = viewer?.querySelector<HTMLElement>(`[data-viewer-page="${activeSearchMatch.pageNumber}"]`);
      const marks = page?.querySelectorAll<HTMLElement>(
        `[data-search-side="${activeSearchMatch.side}"] mark[data-search-match]`
      );
      const activeMark = marks?.[activeSearchMatch.occurrence];
      if (activeMark) {
        activeMark.classList.add("search-highlight-active");
        activeMark.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        page?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSearchMatch]);

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

  if (groupedChunks.length === 0) {
    return null;
  }

  return (
    <div ref={viewerRef} className="space-y-4">
      <div className="z-10 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:sticky md:top-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageJumpControl
            currentPage={currentPage}
            minPage={firstPage}
            totalPages={lastPage}
            unitLabel={unitLabel}
            onPageChange={scrollToPage}
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Enter a number, use the stepper, or scroll normally.
          </span>
        </div>
        <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <BilingualSearchControls
            query={searchQuery}
            resultCount={searchMatches.length}
            activeResultIndex={activeSearchIndex}
            activeResultLabel={activeSearchLabel}
            onQueryChange={handleSearchQueryChange}
            onPrevious={() => moveSearch(-1)}
            onNext={() => moveSearch(1)}
          />
        </div>
        <div className="mt-3 hidden grid-cols-2 gap-3 border-t border-slate-200 pt-3 dark:border-slate-800 md:grid">
          <p className="eyebrow">Original Chinese</p>
          <p className="eyebrow">English Translation</p>
        </div>
      </div>

      {groupedChunks.map((group) => (
        <section
          key={`side-by-side-page-${group.pageNumber}`}
          data-viewer-page={group.pageNumber}
          className="scroll-mt-48 space-y-3"
        >
          <div className="flex flex-wrap items-center gap-2 px-1">
            <p className="eyebrow">{unitLabel} {group.pageNumber}</p>
            {group.chunks.length > 1 ? (
              <span className="status-pill">{group.chunks.length} segments</span>
            ) : null}
          </div>

          {group.chunks.map((chunk) => {
            const parsed = parseTranslationText(chunk.translatedEnglish);
            return (
              <div key={chunk.id} className="reader-card grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
                <div
                  data-search-side="source"
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50"
                >
                  <p className="eyebrow mb-2">Original Chinese</p>
                  <div className="text-sm text-slate-800 dark:text-slate-100">
                    <ChineseSourceBody text={chunk.originalChinese} compact highlightQuery={normalizedSearchQuery} />
                  </div>
                </div>
                <div
                  data-search-side="translation"
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50"
                >
                  <p className="eyebrow mb-2">English Translation</p>
                  <div
                    className="document-text text-sm leading-7 text-slate-800 dark:text-slate-100"
                    style={{ fontFamily: "var(--font-doc), Georgia, serif" }}
                  >
                    <StructuredTranslationBody
                      paragraphs={parsed.bodyParagraphs}
                      compact
                      highlightQuery={normalizedSearchQuery}
                    />

                    {parsed.footnotes.length > 0 ? (
                      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/70">
                        <p className="eyebrow mb-2">Footnotes</p>
                        <ol className="space-y-1.5">
                          {parsed.footnotes.map((note) => (
                            <li key={`${chunk.id}-${note.marker}-${note.content.slice(0, 16)}`}>
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
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
