"use client";

type TextInputPanelProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function TextInputPanel({ value, onChange }: TextInputPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/60">
      <label className="block text-sm font-medium text-slate-800 dark:text-slate-100">Or paste Chinese text</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste Traditional or Simplified Chinese text here..."
        className="mt-3 h-48 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900"
      />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{value.length.toLocaleString()} characters</p>
    </div>
  );
}
