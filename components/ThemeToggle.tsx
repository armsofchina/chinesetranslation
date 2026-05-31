"use client";

import { ThemePreference } from "@/lib/types";

type ThemeToggleProps = {
  value: ThemePreference;
  onChange: (theme: ThemePreference) => void;
};

const OPTIONS: ThemePreference[] = ["system", "light", "dark"];

export default function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white p-1 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-lg px-3 py-1.5 capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
            value === option
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          }`}
          aria-pressed={value === option}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
