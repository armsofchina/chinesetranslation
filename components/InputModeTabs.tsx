"use client";

export type InputMode = "pdf" | "text" | "image";

type InputModeTabsProps = {
  value: InputMode;
  onChange: (mode: InputMode) => void;
};

const OPTIONS: Array<{
  id: InputMode;
  label: string;
  eyebrow: string;
  description: string;
  detail: string;
  badge: string;
}> = [
  {
    id: "pdf",
    label: "Upload PDF",
    eyebrow: "Structured documents",
    description: "Best for articles, reports, and multipage source files.",
    detail: "Selectable text translates fastest. Image-based pages can fall back to OCR.",
    badge: "Recommended"
  },
  {
    id: "image",
    label: "Upload Image",
    eyebrow: "Scans and screenshots",
    description: "Best for scans, photos, screenshots, and clipped excerpts.",
    detail: "Runs OCR first, then translation. Review names and tables carefully.",
    badge: "OCR"
  },
  {
    id: "text",
    label: "Paste Text",
    eyebrow: "Fastest start",
    description: "Best for short passages, emails, excerpts, and quick checks.",
    detail: "Paste Traditional or Simplified Chinese directly into the workspace.",
    badge: "Quick"
  }
];

export default function InputModeTabs({ value, onChange }: InputModeTabsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-[24px] border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
            option.id === value
              ? "border-amber-400 bg-amber-50/80 text-amber-950 shadow-sm ring-1 ring-amber-200 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900/40"
              : "border-slate-300 bg-white/85 text-slate-700 hover:border-amber-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-900"
          }`}
          aria-pressed={option.id === value}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-70">{option.eyebrow}</p>
              <p className="mt-2 text-sm font-semibold">{option.label}</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                option.id === value
                  ? "bg-amber-700 text-amber-50 dark:bg-amber-400 dark:text-slate-950"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {option.badge}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6">{option.description}</p>
          <p className="mt-2 text-xs leading-5 opacity-80">{option.detail}</p>
        </button>
      ))}
    </div>
  );
}
