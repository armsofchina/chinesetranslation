"use client";

import ThemeToggle from "@/components/ThemeToggle";
import { ThemePreference } from "@/lib/types";

type AppHeaderProps = {
  theme: ThemePreference;
  onThemeChange: (value: ThemePreference) => void;
  onOpenApiSettings: () => void;
};

export default function AppHeader({ theme, onThemeChange, onOpenApiSettings }: AppHeaderProps) {
  return (
    <header className="rounded-[30px] border border-amber-200/70 bg-white/80 p-6 shadow-soft backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,_1fr)_auto] lg:items-start">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">
            Bilingual Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            Chinese PDF/Text Translator
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Translate selectable PDFs, scanned PDFs, uploaded images, or pasted Chinese text, then review results in
            reading-friendly layouts and exportable formats.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <ThemeToggle value={theme} onChange={onThemeChange} />
          <button
            type="button"
            onClick={onOpenApiSettings}
            className="rounded-full border border-slate-300 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
          >
            API Key Settings
          </button>
        </div>
      </div>
    </header>
  );
}
