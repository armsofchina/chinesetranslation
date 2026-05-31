"use client";

export type InputMode = "pdf" | "text";

type InputModeTabsProps = {
  value: InputMode;
  onChange: (mode: InputMode) => void;
};

const OPTIONS: Array<{ id: InputMode; label: string; description: string }> = [
  {
    id: "pdf",
    label: "Upload PDF",
    description: "Extract from selectable Chinese PDFs"
  },
  {
    id: "text",
    label: "Paste Text",
    description: "Paste Traditional or Simplified Chinese"
  }
];

export default function InputModeTabs({ value, onChange }: InputModeTabsProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
            option.id === value
              ? "border-sky-500 bg-sky-50 text-sky-900 dark:border-sky-500 dark:bg-sky-900/30 dark:text-sky-100"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          <p className="text-sm font-semibold">{option.label}</p>
          <p className="mt-0.5 text-xs opacity-80">{option.description}</p>
        </button>
      ))}
    </div>
  );
}
