"use client";

export type InputMode = "pdf" | "text" | "image";

type InputModeTabsProps = {
  value: InputMode;
  onChange: (mode: InputMode) => void;
};

const OPTIONS: Array<{ id: InputMode; label: string }> = [
  { id: "pdf", label: "PDF" },
  { id: "image", label: "Image" },
  { id: "text", label: "Paste Text" }
];

export default function InputModeTabs({ value, onChange }: InputModeTabsProps) {
  return (
    <div className="grid w-full grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/60">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-md px-2.5 py-2 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
            option.id === value
              ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-slate-50"
              : "text-slate-500 hover:bg-white/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-200"
          }`}
          aria-pressed={option.id === value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
