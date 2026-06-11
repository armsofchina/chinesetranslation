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
      <article className="reader-card p-4">
        <p className="eyebrow mb-3">Original Image</p>
        <img src={imageDataUrl} alt="Uploaded source" className="max-h-[72vh] w-full rounded-xl border border-slate-200 object-contain dark:border-slate-800" />
      </article>

      <article className="reader-card p-4">
        <p className="eyebrow mb-3">English Translation</p>
        <div className="document-text text-sm leading-8 text-slate-800 dark:text-slate-100" style={{ fontFamily: "var(--font-doc), Georgia, serif" }}>
          <StructuredTranslationBody paragraphs={parsed.bodyParagraphs} compact />
          {parsed.footnotes.length > 0 ? (
            <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="eyebrow mb-3">Footnotes</p>
              <ol className="space-y-2">
                {parsed.footnotes.map((note) => (
                  <li key={`${note.marker}-${note.content.slice(0, 24)}`} className="text-sm leading-7 text-slate-700 dark:text-slate-200">
                    <span className="mr-2 font-semibold text-slate-900 dark:text-slate-100">{note.marker}</span>
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
