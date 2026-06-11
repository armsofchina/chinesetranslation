"use client";

import { DOMAINS, TranslationDomain } from "@/lib/prompts";

type DomainSelectorProps = {
  value: TranslationDomain;
  onChange: (domain: TranslationDomain) => void;
  disabled?: boolean;
};

export default function DomainSelector({ value, onChange, disabled }: DomainSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {DOMAINS.map((domain) => (
        <button
          key={domain.id}
          type="button"
          onClick={() => onChange(domain.id)}
          disabled={disabled}
          title={domain.description}
          className={`min-h-8 rounded-md px-2 py-1.5 text-left text-[11px] font-medium leading-4 transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
            domain.id === value
              ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
              : "border border-slate-200 bg-white/70 text-slate-500 hover:bg-white hover:text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        >
          {domain.label}
        </button>
      ))}
    </div>
  );
}
