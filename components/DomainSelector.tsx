"use client";

import { DOMAINS, TranslationDomain } from "@/lib/prompts";

type DomainSelectorProps = {
  value: TranslationDomain;
  onChange: (domain: TranslationDomain) => void;
  disabled?: boolean;
};

const TYPE_ICON: Record<TranslationDomain, string> = {
  general: "✦",
  historical: "📜",
  legal: "⚖️",
  medical: "🩺",
  literary: "📖"
};

export default function DomainSelector({ value, onChange, disabled }: DomainSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-full border border-amber-200 bg-amber-50/60 p-1 dark:border-slate-700 dark:bg-slate-950/60">
      {DOMAINS.map((domain) => (
        <button
          key={domain.id}
          type="button"
          onClick={() => onChange(domain.id)}
          disabled={disabled}
          title={domain.description}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
            domain.id === value
              ? "bg-gradient-to-br from-amber-700 to-amber-600 text-amber-50 shadow-sm dark:from-amber-500 dark:to-amber-500 dark:text-slate-950"
              : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
          } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <span aria-hidden="true">{TYPE_ICON[domain.id]}</span>
          {domain.label}
        </button>
      ))}
    </div>
  );
}
