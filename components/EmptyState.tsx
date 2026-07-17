"use client";

import { useId, useState } from "react";
import TranslationHistoryList from "@/components/TranslationHistoryList";
import { TranslationHistoryEntry } from "@/lib/translationHistory";

type EmptyStateProps = {
  onFileDrop: (file: File) => void;
  onTextDrop: (text: string) => void;
  onPasteText: () => void;
  historyEntries?: TranslationHistoryEntry[];
  onRestoreHistory?: (entry: TranslationHistoryEntry) => void;
  onDeleteHistory?: (id: string) => void;
  onOpenHistory?: () => void;
};

export default function EmptyState({ onFileDrop, onTextDrop, onPasteText, historyEntries = [], onRestoreHistory, onDeleteHistory, onOpenHistory }: EmptyStateProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  return (
    <section
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) {
          onFileDrop(file);
          return;
        }
        const text = event.dataTransfer.getData("text/plain");
        if (text.trim()) {
          onTextDrop(text);
        }
      }}
      className={`workspace-panel flex min-h-[520px] items-center justify-center border-dashed p-8 text-center transition ${
        isDragging
          ? "border-sky-400 bg-sky-50/70 dark:border-sky-500 dark:bg-sky-950/20"
          : ""
      }`}
    >
      <input
        id={inputId}
        type="file"
        accept=".pdf,.docx,.epub,.pptx,.txt,.md,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/markdown,image/png,image/jpeg,image/webp,image/bmp,image/tiff"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFileDrop(file);
          }
          event.target.value = "";
        }}
      />
      <div className="mx-auto max-w-md">
        <p className="eyebrow">Workspace</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-50">
          {isDragging ? "Drop to load your source" : "Load a source to begin"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Drag a PDF, DOCX, EPUB, PowerPoint, image, or .txt file anywhere on this
          page, drop selected text from another app, or paste Chinese text directly.
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <label htmlFor={inputId} className="primary-button w-full cursor-pointer px-4 py-2.5 text-sm sm:w-auto">
            Choose a file
          </label>
          <button type="button" onClick={onPasteText} className="secondary-button w-full px-4 py-2.5 text-sm sm:w-auto">
            Paste text
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Tip: press Cmd/Ctrl+V anywhere to paste text or a screenshot.
        </p>
        {historyEntries.length > 0 && onRestoreHistory && onDeleteHistory ? (
          <div className="mt-6 w-full border-t border-slate-200 pt-4 text-left dark:border-slate-800">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="eyebrow">Recent translations</p>
              {historyEntries.length > 3 && onOpenHistory ? (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="text-sm font-medium text-sky-600 transition hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                >
                  View all {historyEntries.length}
                </button>
              ) : null}
            </div>
            <TranslationHistoryList
              entries={historyEntries.slice(0, 3)}
              onRestore={onRestoreHistory}
              onDelete={onDeleteHistory}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
