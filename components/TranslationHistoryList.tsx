"use client";

import { useEffect, useState } from "react";
import { TranslationHistoryEntry } from "@/lib/translationHistory";

type TranslationHistoryListProps = {
  entries: TranslationHistoryEntry[];
  onRestore: (entry: TranslationHistoryEntry) => void;
  onDelete: (id: string) => void;
  onClearAll?: () => void;
};

const formatRelativeTime = (timestamp: number): string => {
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

const formatEntryMeta = (entry: TranslationHistoryEntry): string => {
  const parts = [
    formatRelativeTime(entry.savedAt),
    `${entry.unitCount} ${entry.unitLabel}${entry.unitCount === 1 ? "" : "s"}`,
    `${entry.sourceCharacters.toLocaleString()} chars`
  ];
  if (entry.usedModel) {
    parts.push(entry.usedModel);
  }
  return parts.join(" · ");
};

export default function TranslationHistoryList({ entries, onRestore, onDelete, onClearAll }: TranslationHistoryListProps) {
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    if (!confirmingClear) {
      return;
    }
    const timer = window.setTimeout(() => setConfirmingClear(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmingClear]);

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No completed translations yet. Finished jobs will appear here.
      </p>
    );
  }

  return (
    <div>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li key={entry.id}>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-sky-700">
              <button
                type="button"
                onClick={() => onRestore(entry)}
                className="min-w-0 flex-1 text-left"
                title="Restore this translation into the workspace"
              >
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{entry.sourceLabel}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{formatEntryMeta(entry)}</p>
              </button>
              <button
                type="button"
                onClick={() => onDelete(entry.id)}
                className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                aria-label={`Delete ${entry.sourceLabel} from history`}
                title="Delete from history"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">Saved only on this device.</p>
        {onClearAll ? (
          <button
            type="button"
            onClick={() => {
              if (confirmingClear) {
                setConfirmingClear(false);
                onClearAll();
              } else {
                setConfirmingClear(true);
              }
            }}
            className={`text-sm font-medium transition ${
              confirmingClear
                ? "text-rose-600 dark:text-rose-300"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {confirmingClear ? "Tap again to clear all" : "Clear all"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

type TranslationHistoryModalProps = TranslationHistoryListProps & {
  open: boolean;
  onClose: () => void;
};

export function TranslationHistoryModal({ open, onClose, entries, onRestore, onDelete, onClearAll }: TranslationHistoryModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close translation history"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="translation-history-title"
        className="workspace-panel relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">History</p>
            <h2 id="translation-history-title" className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-50">
              Recent translations
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Newest {entries.length} kept on this device. Select one to reopen it in the workspace.
            </p>
          </div>
          <button type="button" onClick={onClose} className="secondary-button px-3 py-1.5 text-sm">
            Close
          </button>
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          <TranslationHistoryList entries={entries} onRestore={onRestore} onDelete={onDelete} onClearAll={onClearAll} />
        </div>
      </section>
    </div>
  );
}
