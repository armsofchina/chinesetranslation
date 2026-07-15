"use client";

export type ProgressStep = "idle" | "extracting" | "preparing" | "translating" | "generating" | "done";

type ProgressIndicatorProps = {
  step: ProgressStep;
  processing: boolean;
  completedUnits?: number;
  totalUnits?: number;
  statusMessage?: string;
  streaming?: boolean;
};

const stepLabel: Record<Exclude<ProgressStep, "idle" | "done">, string> = {
  extracting: "Extracting",
  preparing: "Preparing",
  translating: "Translating",
  generating: "Finalizing"
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
    <section className="workspace-panel p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {!isDone && (
            <span className="relative flex h-2 w-2">
              <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="absolute inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
          )}
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            {isDone ? "Done" : streaming ? "Live translation" : stepLabel[step as Exclude<ProgressStep, "idle" | "done">]}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          {totalUnits > 0 ? (
            <span>
              {Math.min(completedUnits, totalUnits)} / {totalUnits}
            </span>
          ) : null}
          <span className="tabular-nums font-semibold text-slate-600 dark:text-slate-300">
            {roundedPercent}%
          </span>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            isDone ? "bg-emerald-500" : "bg-amber-500"
          }`}
          style={{ width: `${Math.max(roundedPercent, 2)}%` }}
        />
      </div>

      {statusMessage ? (
        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">{statusMessage}</p>
      ) : null}
    </section>
  );
}
