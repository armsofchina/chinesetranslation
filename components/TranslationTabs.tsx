"use client";

export type TranslationView = "original" | "english" | "side-by-side";

type TranslationTabsProps = {
  active: TranslationView;
  onChange: (view: TranslationView) => void;
  disabledViews?: TranslationView[];
};

const OPTIONS: Array<{ id: TranslationView; label: string }> = [
  { id: "original", label: "Original" },
  { id: "english", label: "English" },
  { id: "side-by-side", label: "Side by side" }
];

export default function TranslationTabs({ active, onChange, disabledViews = [] }: TranslationTabsProps) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/60">
      {OPTIONS.map((option) => {
        const disabled = disabledViews.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            disabled={disabled}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
              active === option.id
                ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50"
                : "text-slate-500 hover:bg-white/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-200"
            } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
            aria-pressed={active === option.id}
            aria-disabled={disabled}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
