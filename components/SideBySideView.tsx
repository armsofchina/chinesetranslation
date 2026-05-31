"use client";

import { TranslationChunk } from "@/lib/types";

type SideBySideViewProps = {
  chunks: TranslationChunk[];
};

export default function SideBySideView({ chunks }: SideBySideViewProps) {
  return (
    <div className="space-y-4">
      <div className="sticky top-2 z-10 hidden grid-cols-2 gap-3 rounded-2xl border border-amber-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 md:grid">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Original Chinese</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          English Translation
        </p>
      </div>

      {chunks.map((chunk) => (
        <div
          key={chunk.id}
          className="grid grid-cols-1 gap-4 rounded-3xl border border-amber-200/70 bg-white/90 p-4 shadow-soft dark:border-slate-700 dark:bg-slate-900/75 md:grid-cols-2"
        >
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3 dark:border-slate-700 dark:bg-slate-950/60">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Original Chinese</p>
            <p className="document-text text-sm leading-7 text-slate-800 dark:text-slate-100">{chunk.originalChinese}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3 dark:border-slate-700 dark:bg-slate-950/60">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              English Translation
            </p>
            <p
              className="document-text text-sm leading-7 text-slate-800 dark:text-slate-100"
              style={{ fontFamily: "var(--font-doc), Georgia, serif" }}
            >
              {chunk.translatedEnglish}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
