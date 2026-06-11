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
    <header className="workspace-panel flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-xl">
          Chinese to English Translator
        </h1>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">OCR, glossary, review, and export in one workspace</p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`status-pill hidden sm:inline-flex ${
            usingCustomKey ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200" : ""
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${usingCustomKey ? "bg-emerald-500" : "bg-slate-400"}`} />
          {usingCustomKey ? "Personal key" : "Shared key"}
        </span>
        <ThemeToggle value={theme} onChange={onThemeChange} />
        <button
          type="button"
          onClick={onOpenApiSettings}
          className="secondary-button px-3 py-2 text-xs"
          title="API key and connection settings"
        >
          Settings
        </button>
      </div>
    </header>
  );
}
