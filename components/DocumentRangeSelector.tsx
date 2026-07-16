"use client";

type DocumentRangeSelectorProps = {
  start: number;
  end: number;
  totalUnits: number;
  selectedUnits: number;
  unitLabel: string;
  disabled?: boolean;
  onChange: (start: number, end: number) => void;
};

const clamp = (value: number, totalUnits: number): number =>
  Math.max(1, Math.min(Number.isFinite(value) ? Math.round(value) : 1, Math.max(totalUnits, 1)));

export default function DocumentRangeSelector({
  start,
  end,
  totalUnits,
  selectedUnits,
  unitLabel,
  disabled,
  onChange
}: DocumentRangeSelectorProps) {
  const updateStart = (value: number) => {
    const nextStart = clamp(value, totalUnits);
    onChange(nextStart, Math.max(end, nextStart));
  };

  const updateEnd = (value: number) => {
    const nextEnd = clamp(value, totalUnits);
    onChange(Math.min(start, nextEnd), nextEnd);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Translation range</p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {selectedUnits} readable {unitLabel}{selectedUnits === 1 ? "" : "s"} selected
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(1, Math.max(totalUnits, 1))}
          disabled={disabled || (start === 1 && end === totalUnits)}
          className="secondary-button px-2.5 py-1.5 text-sm"
        >
          All
        </button>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">From</span>
          <input
            type="number"
            min={1}
            max={Math.max(totalUnits, 1)}
            value={start}
            onChange={(event) => updateStart(Number(event.target.value))}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900/30"
          />
        </label>
        <span className="pb-2 text-sm text-slate-500 dark:text-slate-400">to</span>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">To</span>
          <input
            type="number"
            min={1}
            max={Math.max(totalUnits, 1)}
            value={end}
            onChange={(event) => updateEnd(Number(event.target.value))}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900/30"
          />
        </label>
      </div>
    </div>
  );
}
