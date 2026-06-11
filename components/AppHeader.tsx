"use client";

import ThemeToggle from "@/components/ThemeToggle";
import { ThemePreference } from "@/lib/types";

type AppHeaderProps = {
  theme: ThemePreference;
  usingCustomKey: boolean;
  onThemeChange: (value: ThemePreference) => void;
  onOpenApiSettings: () => void;
};

export default function AppHeader({ theme, usingCustomKey, onThemeChange, onOpenApiSettings }: AppHeaderProps) {
  return (
    <header className="rounded-[32px] border border-amber-200/70 bg-white/80 p-6 shadow-soft backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,_1fr)_auto] xl:items-start">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">
            Bilingual Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            Chinese PDF/Text Translator
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Translate PDFs, scans, screenshots, and pasted Chinese inside a single review workspace with OCR fallback,
            glossary control, and export-ready reading views.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium ${
              usingCustomKey
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${usingCustomKey ? "bg-emerald-500" : "bg-slate-400"}`} />
            {usingCustomKey ? "Personal PPQ key" : "Using shared app key"}
          </span>
          <ThemeToggle value={theme} onChange={onThemeChange} />
          <button
            type="button"
            onClick={onOpenApiSettings}
            className="rounded-full border border-slate-300 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
          >
            Connection
          </button>
        </div>
      </div>
    </header>
  );
}
