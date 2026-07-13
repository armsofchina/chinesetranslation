"use client";

import { DOMAINS, TranslationDomain } from "@/lib/prompts";

type DomainSelectorProps = {
  value: TranslationDomain;
  onChange: (domain: TranslationDomain) => void;
  disabled?: boolean;
};

export default function DomainSelector({ value, onChange, disabled }: DomainSelectorProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">Translation profile</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as TranslationDomain)}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900/30"
      >
        {DOMAINS.map((domain) => (
          <option key={domain.id} value={domain.id}>
            {domain.label}
          </option>
        ))}
      </select>
    </label>
  );
}
