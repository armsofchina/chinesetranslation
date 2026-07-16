"use client";

import { useEffect } from "react";
import DocumentRangeSelector from "@/components/DocumentRangeSelector";

export type TranslationPreflightSummary = {
  sourceCharacters: number;
  estimatedRequests: number;
  estimatedInputTokens: number;
  ocrPages: number;
  selectedUnits: number;
  totalUnits: number;
  unitLabel: string;
  sourceLabel: string;
};

type LargeFileWarningModalProps = {
  open: boolean;
  summary: TranslationPreflightSummary;
  range?: { start: number; end: number };
  onRangeChange?: (start: number, end: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function LargeFileWarningModal({
  open,
  summary,
  range,
  onRangeChange,
  onCancel,
  onConfirm
}: LargeFileWarningModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close large file warning"
        onClick={onCancel}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="large-file-warning-title"
        className="workspace-panel relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg text-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
            !
          </span>
          <div>
            <p className="eyebrow">Usage check</p>
            <h2 id="large-file-warning-title" className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-50">
              Review this large translation job
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              This source may use substantial model credits. Narrow the range or confirm the selected job before translation begins.
            </p>
          </div>
        </div>

        {range && onRangeChange && summary.totalUnits > 1 ? (
          <div className="workspace-panel-quiet mt-5 p-4">
            <DocumentRangeSelector
              start={range.start}
              end={range.end}
              totalUnits={summary.totalUnits}
              selectedUnits={summary.selectedUnits}
              unitLabel={summary.unitLabel}
              onChange={onRangeChange}
            />
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="workspace-panel-quiet p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Selected</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {summary.selectedUnits} {summary.unitLabel}{summary.selectedUnits === 1 ? "" : "s"}
            </p>
          </div>
          <div className="workspace-panel-quiet p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Characters</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {summary.sourceCharacters.toLocaleString()}
            </p>
          </div>
          <div className="workspace-panel-quiet p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">API requests</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              ~{summary.estimatedRequests.toLocaleString()}
            </p>
          </div>
          <div className="workspace-panel-quiet p-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">Input tokens</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              ~{summary.estimatedInputTokens.toLocaleString()}
            </p>
          </div>
        </div>

        {summary.ocrPages > 0 ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            {summary.ocrPages} selected page{summary.ocrPages === 1 ? "" : "s"} require OCR plus translation, which uses additional requests.
          </p>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Estimates include prompt and context overhead, but not output tokens. Automatic retries can increase actual usage by up to three times for failed requests.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="secondary-button px-4 py-2.5">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="primary-button px-4 py-2.5">
            Translate selected range
          </button>
        </div>
      </section>
    </div>
  );
}
