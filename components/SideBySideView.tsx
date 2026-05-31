"use client";

import { TranslationChunk } from "@/lib/types";

type SideBySideViewProps = {
  chunks: TranslationChunk[];
};

export default function SideBySideView({ chunks }: SideBySideViewProps) {
  return (
    <div className="space-y-3">
      {chunks.map((chunk) => (
        <div
          key={chunk.id}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70 md:grid-cols-2"
        >
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Chinese {chunk.pageNumber ? `(Page ${chunk.pageNumber})` : ""}
            </p>
            <p className="document-text text-sm text-slate-800 dark:text-slate-100">{chunk.originalChinese}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">English</p>
            <p
              className="document-text text-sm text-slate-800 dark:text-slate-100"
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
