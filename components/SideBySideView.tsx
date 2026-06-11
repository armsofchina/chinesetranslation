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
      <div className="sticky top-2 z-10 hidden grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:grid">
        <p className="eyebrow">Original Chinese</p>
        <p className="eyebrow">
          English Translation
        </p>
      </div>

      {chunks.map((chunk) => {
        const parsed = parseTranslationText(chunk.translatedEnglish);
        return (
          <div
            key={chunk.id}
            className="reader-card grid grid-cols-1 gap-3 p-3 md:grid-cols-2"
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <p className="eyebrow mb-2">Original Chinese</p>
              <div className="text-sm text-slate-800 dark:text-slate-100">
                <ChineseSourceBody text={chunk.originalChinese} compact />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/50">
              <p className="eyebrow mb-2">
                English Translation
              </p>
              <div
                className="document-text text-sm leading-7 text-slate-800 dark:text-slate-100"
                style={{ fontFamily: "var(--font-doc), Georgia, serif" }}
              >
                <StructuredTranslationBody paragraphs={parsed.bodyParagraphs} compact />

                {parsed.footnotes.length > 0 ? (
                  <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/70">
                    <p className="eyebrow mb-2">Footnotes</p>
                    <ol className="space-y-1.5">
                      {parsed.footnotes.map((note) => (
                        <li key={`${chunk.id}-${note.marker}-${note.content.slice(0, 16)}`}>
                          <span className="mr-2 font-semibold text-slate-900 dark:text-slate-100">{note.marker}</span>
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
