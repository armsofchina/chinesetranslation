"use client";

import { FormEvent, useEffect, useId, useState } from "react";

type PageJumpControlProps = {
  currentPage: number;
  minPage?: number;
  totalPages: number;
  unitLabel?: string;
  onPageChange: (pageNumber: number) => void;
};

export function PageJumpControl({
  currentPage,
  minPage = 1,
  totalPages,
  unitLabel = "Page",
  onPageChange
}: PageJumpControlProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(String(currentPage));

  useEffect(() => {
    setDraft(String(currentPage));
  }, [currentPage]);

  const commitPage = (value: string) => {
    const parsedPage = Number.parseInt(value, 10);
    const safePage = Number.isFinite(parsedPage)
      ? Math.max(minPage, Math.min(totalPages, parsedPage))
      : currentPage;
    setDraft(String(safePage));
    onPageChange(safePage);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    commitPage(draft);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5" aria-label={`${unitLabel} navigation`}>
      <label htmlFor={inputId} className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {unitLabel}
      </label>
      <input
        id={inputId}
        type="number"
        min={minPage}
        max={totalPages}
        step={1}
        value={draft}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);
          const parsedPage = Number.parseInt(nextDraft, 10);
          if (Number.isFinite(parsedPage) && parsedPage >= minPage && parsedPage <= totalPages) {
            onPageChange(parsedPage);
          }
        }}
        onBlur={() => commitPage(draft)}
        className="h-8 w-16 rounded-lg border border-slate-300 bg-white px-2 text-center text-xs font-semibold tabular-nums text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900"
        aria-label={`Go to ${unitLabel.toLowerCase()}`}
      />
      <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
        {minPage === 1 ? `of ${totalPages}` : `${minPage}–${totalPages}`}
      </span>
      <button type="submit" className="secondary-button h-8 px-2.5 text-xs">
        Go
      </button>
    </form>
  );
}

type BilingualSearchControlsProps = {
  query: string;
  resultCount: number;
  activeResultIndex: number;
  activeResultLabel?: string;
  onQueryChange: (query: string) => void;
  onPrevious: () => void;
  onNext: () => void;
};

export function BilingualSearchControls({
  query,
  resultCount,
  activeResultIndex,
  activeResultLabel,
  onQueryChange,
  onPrevious,
  onNext
}: BilingualSearchControlsProps) {
  const inputId = useId();
  const hasQuery = Boolean(query.trim());
  const hasResults = resultCount > 0;
  const hasActiveResult = activeResultIndex >= 0;
  const resultStatus = !hasQuery
    ? "Search both languages"
    : hasResults
      ? hasActiveResult
        ? `${activeResultIndex + 1} of ${resultCount}${activeResultLabel ? ` · ${activeResultLabel}` : ""}`
        : `${resultCount} matches · none on this page`
      : "No matches";

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2" role="search">
      <label htmlFor={inputId} className="sr-only">
        Search Chinese and English text
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search Chinese or English…"
        className="h-9 min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-sky-900 sm:max-w-sm"
      />
      <span className="min-w-0 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
        {resultStatus}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!hasResults}
          className="secondary-button h-8 px-2.5 text-xs"
          aria-label="Previous search match"
        >
          Prev match
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasResults}
          className="secondary-button h-8 px-2.5 text-xs"
          aria-label="Next search match"
        >
          Next match
        </button>
      </div>
    </div>
  );
}
