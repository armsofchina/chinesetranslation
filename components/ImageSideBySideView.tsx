"use client";

import StructuredTranslationBody from "@/components/StructuredTranslationBody";
import { parseTranslationText } from "@/lib/footnotes";

type ImageSideBySideViewProps = {
  imageDataUrl: string;
  translatedText: string;
};

export default function ImageSideBySideView({ imageDataUrl, translatedText }: ImageSideBySideViewProps) {
  const parsed = parseTranslationText(translatedText);

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <article className="rounded-3xl border border-amber-200/70 bg-white/90 p-4 shadow-soft dark:border-slate-700 dark:bg-slate-900/75">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Original Image</p>
        <img src={imageDataUrl} alt="Uploaded source" className="max-h-[72vh] w-full rounded-2xl border border-amber-100 object-contain dark:border-slate-700" />
      </article>

      <article className="rounded-3xl border border-amber-200/70 bg-white/90 p-4 shadow-soft dark:border-slate-700 dark:bg-slate-900/75">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">English Translation</p>
        <div className="document-text text-sm leading-8 text-slate-800 dark:text-slate-100" style={{ fontFamily: "var(--font-doc), Georgia, serif" }}>
          <StructuredTranslationBody paragraphs={parsed.bodyParagraphs} compact />
          {parsed.footnotes.length > 0 ? (
            <section className="mt-6 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-900/80 dark:bg-amber-950/30">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">Footnotes</p>
              <ol className="space-y-2">
                {parsed.footnotes.map((note) => (
                  <li key={`${note.marker}-${note.content.slice(0, 24)}`} className="text-sm leading-7 text-slate-700 dark:text-slate-200">
                    <span className="mr-2 font-semibold text-amber-800 dark:text-amber-200">{note.marker}</span>
                    <span>{note.content}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </article>
    </section>
  );
}
