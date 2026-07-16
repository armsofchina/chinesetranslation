"use client";

import { useEffect, useState } from "react";
import ChineseSourceBody from "@/components/ChineseSourceBody";
import { TranslationQualityIssue } from "@/lib/qualityChecks";
import { TranslationChunk } from "@/lib/types";

type TranslationEditorProps = {
  chunks: TranslationChunk[];
  issues: TranslationQualityIssue[];
  approvedChunkIds: string[];
  onCommit: (chunkId: string, translatedEnglish: string) => void;
  onToggleApproved: (chunkId: string) => void;
  onRetranslate: (chunkId: string) => Promise<void>;
  onNoteChange: (chunkId: string, note: string) => void;
};

function SegmentEditor({
  chunk,
  issues,
  approved,
  onCommit,
  onToggleApproved,
  onRetranslate,
  onNoteChange
}: {
  chunk: TranslationChunk;
  issues: TranslationQualityIssue[];
  approved: boolean;
  onCommit: (chunkId: string, translatedEnglish: string) => void;
  onToggleApproved: (chunkId: string) => void;
  onRetranslate: (chunkId: string) => Promise<void>;
  onNoteChange: (chunkId: string, note: string) => void;
}) {
  const [draft, setDraft] = useState(chunk.translatedEnglish);
  const [retranslating, setRetranslating] = useState(false);

  useEffect(() => {
    setDraft(chunk.translatedEnglish);
  }, [chunk.translatedEnglish]);

  const commit = () => {
    if (draft !== chunk.translatedEnglish) {
      onCommit(chunk.id, draft);
    }
  };

  return (
    <article id={`translation-segment-${chunk.id}`} className="reader-card scroll-mt-36 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Page / section {chunk.pageNumber}</p>
          {issues.map((issue) => (
            <span
              key={issue.id}
              title={issue.message}
              className={`status-pill ${
                issue.severity === "error"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
              }`}
            >
              {issue.code}
            </span>
          ))}
          {chunk.translationMemoryHit ? <span className="status-pill bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">Reused translation</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={retranslating}
            onClick={() => {
              setRetranslating(true);
              void onRetranslate(chunk.id).finally(() => setRetranslating(false));
            }}
            className="secondary-button px-3 py-1.5 text-sm"
          >
            {retranslating ? "Retranslating…" : "Retranslate"}
          </button>
          <button
            type="button"
            onClick={() => onToggleApproved(chunk.id)}
            className={`secondary-button px-3 py-1.5 text-sm ${
              approved
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                : ""
            }`}
          >
            {approved ? "Approved" : "Mark approved"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="eyebrow mb-3">Source</p>
          <ChineseSourceBody text={chunk.originalChinese} compact />
        </div>
        <label className="block">
          <span className="eyebrow mb-3 block">Editable English</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            className="min-h-64 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 font-serif text-[15px] leading-7 text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900/30"
          />
        </label>
      </div>

      {issues.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {issues.map((issue) => (
            <li key={`${issue.id}-message`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}
      {chunk.qa && (chunk.qa.facts.length > 0 || chunk.qa.terms.length > 0) ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          {chunk.qa.facts.map((fact) => (
            <span key={`${fact.kind}-${fact.normalized}`} className={`status-pill ${fact.matched ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
              {fact.kind}: {fact.source} {fact.matched ? "✓" : "missing"}
            </span>
          ))}
          {chunk.qa.terms.map((term) => (
            <span key={term.chinese} className={`status-pill ${term.matched ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
              {term.chinese} → {term.expectedEnglish} {term.matched ? "✓" : "review"}
            </span>
          ))}
        </div>
      ) : null}
      <label className="mt-3 block">
        <span className="eyebrow mb-1.5 block">Reviewer note</span>
        <input
          value={chunk.reviewNote || ""}
          onChange={(event) => onNoteChange(chunk.id, event.target.value)}
          placeholder="Add a note for this segment…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        />
      </label>
    </article>
  );
}

export default function TranslationEditor({
  chunks,
  issues,
  approvedChunkIds,
  onCommit,
  onToggleApproved,
  onRetranslate,
  onNoteChange
}: TranslationEditorProps) {
  return (
    <section className="space-y-4">
      {chunks.map((chunk) => (
        <SegmentEditor
          key={chunk.id}
          chunk={chunk}
          issues={issues.filter((issue) => issue.chunkId === chunk.id)}
          approved={approvedChunkIds.includes(chunk.id)}
          onCommit={onCommit}
          onToggleApproved={onToggleApproved}
          onRetranslate={onRetranslate}
          onNoteChange={onNoteChange}
        />
      ))}
    </section>
  );
}
