"use client";

export type ProgressStep = "idle" | "extracting" | "preparing" | "translating" | "generating" | "done";

type ProgressIndicatorProps = {
  step: ProgressStep;
  processing: boolean;
  /** Units (pages/sections) completed so far. */
  completedUnits?: number;
  /** Total units (pages/sections) to translate. */
  totalUnits?: number;
  /** A short live status message, e.g. "Translating page 2 of 8". */
  statusMessage?: string;
  /** True while tokens are actively streaming in. */
  streaming?: boolean;
};

const STEPS: Array<{ id: Exclude<ProgressStep, "idle" | "done">; label: string }> = [
  { id: "extracting", label: "Extract" },
  { id: "preparing", label: "Prepare" },
  { id: "translating", label: "Translate" },
  { id: "generating", label: "Finalize" }
];

const stepRank: Record<ProgressStep, number> = {
  idle: -1,
  extracting: 0,
  preparing: 1,
  translating: 2,
  generating: 3,
  done: 4
};

export default function ProgressIndicator({
  step,
  processing,
  completedUnits = 0,
  totalUnits = 0,
  statusMessage,
  streaming
}: ProgressIndicatorProps) {
  if (!processing && step === "idle") {
    return null;
  }

  const rank = stepRank[step];

  // Compute a smooth overall percentage. Extraction/prep occupy the first slice,
  // translation the bulk, finalize the last slice.
  let percent = 0;
  if (step === "extracting") percent = 6;
  else if (step === "preparing") percent = 12;
  else if (step === "translating") {
    const base = 15;
    const span = 78;
    const ratio = totalUnits > 0 ? Math.min(completedUnits / totalUnits, 1) : 0.15;
    percent = base + span * ratio;
  } else if (step === "generating") percent = 95;
  else if (step === "done") percent = 100;

  const roundedPercent = Math.round(percent);
  const isDone = step === "done";

  return (
    <section className="overflow-hidden rounded-3xl border border-amber-200/70 bg-white/90 shadow-soft backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <span
            className={`relative flex h-2.5 w-2.5 ${isDone ? "" : "animate-pulse"}`}
            aria-hidden
          >
            <span
              className={`inline-flex h-2.5 w-2.5 rounded-full ${
                isDone ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {!isDone ? (
              <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-amber-400 opacity-75" />
            ) : null}
          </span>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {isDone ? "Translation complete" : "Translating…"}
          </p>
          {streaming && !isDone ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
              Live
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {totalUnits > 0 ? (
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {Math.min(completedUnits, totalUnits)} / {totalUnits}
            </span>
          ) : null}
          <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200">
            {roundedPercent}%
          </span>
        </div>
      </div>

      <div className="px-5 pt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-amber-100/70 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isDone
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                : "bg-gradient-to-r from-amber-600 to-amber-400"
            }`}
            style={{ width: `${Math.max(roundedPercent, 4)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 px-5">
        {STEPS.map((item) => {
          const itemRank = stepRank[item.id];
          const isActive = rank === itemRank && processing;
          const isComplete = rank > itemRank || isDone;

          return (
            <div key={item.id} className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition ${
                  isComplete
                    ? "bg-emerald-500 text-white"
                    : isActive
                      ? "bg-amber-500 text-white ring-4 ring-amber-200 dark:ring-amber-900/50"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {isComplete ? "✓" : itemRank + 1}
              </span>
              <span
                className={`text-[11px] font-medium transition ${
                  isActive
                    ? "text-amber-800 dark:text-amber-200"
                    : isComplete
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-amber-100/80 px-5 py-3 dark:border-slate-800">
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {statusMessage || "Large documents may take longer depending on length."}
        </p>
      </div>
    </section>
  );
}
