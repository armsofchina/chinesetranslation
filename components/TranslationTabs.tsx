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
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            active === option.id
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
