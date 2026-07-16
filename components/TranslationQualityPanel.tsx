"use client";

import { TranslationQualityIssue } from "@/lib/qualityChecks";

type TranslationQualityPanelProps = {
  issues: TranslationQualityIssue[];
  totalSegments: number;
  approvedSegments: number;
  onOpenReview: () => void;
};

export default function TranslationQualityPanel({
  issues,
  totalSegments,
  approvedSegments,
  onOpenReview
}: TranslationQualityPanelProps) {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;

  return (
    <section className="workspace-panel-quiet flex flex-wrap items-center justify-between gap-3 p-3">
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Quality review</p>
        <p className="mt-0.5 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {issues.length === 0
            ? "Automated checks found no obvious consistency problems."
            : `${errorCount} error${errorCount === 1 ? "" : "s"} and ${warningCount} warning${warningCount === 1 ? "" : "s"} need review.`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="status-pill">
          {approvedSegments}/{totalSegments} approved
        </span>
        {errorCount > 0 ? (
          <span className="status-pill bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
            {errorCount} errors
          </span>
        ) : null}
        {warningCount > 0 ? (
          <span className="status-pill bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            {warningCount} warnings
          </span>
        ) : null}
        <button type="button" onClick={onOpenReview} className="secondary-button px-3 py-1.5 text-sm">
          Review sections
        </button>
      </div>
    </section>
  );
}
