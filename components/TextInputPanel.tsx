"use client";

type TextInputPanelProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
};

export default function TextInputPanel({ value, onChange, onClear }: TextInputPanelProps) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Paste Text</label>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
        >
          Clear text
        </button>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste Traditional or Simplified Chinese text here..."
        className="mt-3 h-64 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900"
      />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{value.length.toLocaleString()} characters</p>
    </section>
  );
}
