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
    <header className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Chinese PDF/Text Translator
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Upload a Chinese PDF or paste Chinese text to generate a clean English translation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ThemeToggle value={theme} onChange={onThemeChange} />
          <button
            type="button"
            onClick={onOpenApiSettings}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
          >
            API Key Settings
          </button>
        </div>
      </div>
    </header>
  );
}
