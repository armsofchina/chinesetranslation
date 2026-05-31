"use client";

export type TranslationView = "original" | "english" | "side-by-side";

type TranslationTabsProps = {
  active: TranslationView;
  onChange: (view: TranslationView) => void;
};

const OPTIONS: Array<{ id: TranslationView; label: string }> = [
  { id: "original", label: "Original Chinese" },
  { id: "english", label: "English Translation" },
  { id: "side-by-side", label: "Side-by-side" }
];

export default function TranslationTabs({ active, onChange }: TranslationTabsProps) {
  return (
    <div className="inline-flex flex-wrap gap-2 rounded-full border border-amber-200 bg-amber-50/80 p-1 dark:border-slate-700 dark:bg-slate-950/60">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
            active === option.id
              ? "bg-gradient-to-br from-amber-700 to-amber-600 text-amber-50 shadow-sm dark:from-amber-500 dark:to-amber-500 dark:text-slate-950"
              : "text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-800"
          }`}
          aria-pressed={active === option.id}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
