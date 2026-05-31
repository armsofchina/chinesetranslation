"use client";

import { ThemePreference } from "@/lib/types";

type ThemeToggleProps = {
  value: ThemePreference;
  onChange: (theme: ThemePreference) => void;
};

const OPTIONS: ThemePreference[] = ["light", "dark", "system"];

export default function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-full border border-slate-300 bg-white/80 p-1 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-full px-3 py-1.5 capitalize transition ${
            value === option
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
