"use client";

import { ThemePreference } from "@/lib/types";

type ThemeToggleProps = {
  value: ThemePreference;
  onChange: (theme: ThemePreference) => void;
};

const OPTIONS: Array<{ id: ThemePreference; label: string }> = [
  { id: "system", label: "Auto" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" }
];

export default function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm dark:border-slate-800 dark:bg-slate-950/60">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-md px-2.5 py-1.5 font-medium transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
            value === option.id
              ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
          aria-pressed={value === option.id}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
