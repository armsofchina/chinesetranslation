"use client";

type TextInputPanelProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
};

export default function TextInputPanel({ value, onChange, onClear }: TextInputPanelProps) {
  return (
    <section>
      <textarea
        id="source-text-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste Traditional or Simplified Chinese text here..."
        className="h-56 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:ring-sky-900/30"
      />
      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {value.length.toLocaleString()} characters
        </p>
        {value ? (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Clear
          </button>
        ) : null}
      </div>
    </section>
  );
}
