"use client";

import ChineseSourceBody from "@/components/ChineseSourceBody";
import StructuredTranslationBody from "@/components/StructuredTranslationBody";
import { parseTranslationText } from "@/lib/footnotes";
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

      {chunks.map((chunk) => {
        const parsed = parseTranslationText(chunk.translatedEnglish);
        return (
          <div
            key={chunk.id}
            className="grid grid-cols-1 gap-4 rounded-3xl border border-amber-200/70 bg-white/90 p-4 shadow-soft dark:border-slate-700 dark:bg-slate-900/75 md:grid-cols-2"
          >
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3 dark:border-slate-700 dark:bg-slate-950/60">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Original Chinese</p>
              <div className="text-sm text-slate-800 dark:text-slate-100">
                <ChineseSourceBody text={chunk.originalChinese} compact />
              </div>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3 dark:border-slate-700 dark:bg-slate-950/60">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                English Translation
              </p>
              <div
                className="document-text text-sm leading-7 text-slate-800 dark:text-slate-100"
                style={{ fontFamily: "var(--font-doc), Georgia, serif" }}
              >
                <StructuredTranslationBody paragraphs={parsed.bodyParagraphs} compact />

                {parsed.footnotes.length > 0 ? (
                  <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                      Footnotes
                    </p>
                    <ol className="space-y-1.5">
                      {parsed.footnotes.map((note) => (
                        <li key={`${chunk.id}-${note.marker}-${note.content.slice(0, 16)}`}>
                          <span className="mr-2 font-semibold text-amber-800 dark:text-amber-200">{note.marker}</span>
                          <span>{note.content}</span>
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
    </div>
  );
}
