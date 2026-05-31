"use client";

export type ProgressStep = "idle" | "extracting" | "preparing" | "translating" | "generating" | "done";

type ProgressIndicatorProps = {
  step: ProgressStep;
  processing: boolean;
};

const STEPS: Array<{ id: Exclude<ProgressStep, "idle" | "done">; label: string }> = [
  { id: "extracting", label: "Extracting text" },
  { id: "preparing", label: "Preparing chunks" },
  { id: "translating", label: "Translating" },
  { id: "generating", label: "Generating output" }
];

const stepRank: Record<ProgressStep, number> = {
  idle: -1,
  extracting: 0,
  preparing: 1,
  translating: 2,
  generating: 3,
  done: 4
};

export default function ProgressIndicator({ step, processing }: ProgressIndicatorProps) {
  if (!processing && step === "idle") {
    return null;
  }

  return (
    <section className="rounded-3xl border border-amber-200/70 bg-white/85 p-5 shadow-soft dark:border-slate-700 dark:bg-slate-900/75">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Translation progress</p>
        {processing ? <span className="text-xs text-slate-500 dark:text-slate-400">Working...</span> : null}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Large PDFs may take longer depending on document length.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {STEPS.map((item) => {
          const rank = stepRank[step];
          const itemRank = stepRank[item.id];
          const isActive = rank === itemRank && processing;
          const isComplete = rank > itemRank || step === "done";

          return (
            <div
              key={item.id}
              className={`rounded-2xl border px-3 py-2 text-xs transition ${
                isActive
                  ? "border-amber-500 bg-amber-100 text-amber-900 dark:border-amber-500 dark:bg-amber-900/40 dark:text-amber-100"
                  : isComplete
                    ? "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-100"
                    : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
              }`}
            >
              <p className="font-semibold">{item.label}</p>
              {isActive ? <p className="mt-1 animate-pulse">In progress</p> : null}
              {isComplete ? <p className="mt-1">Complete</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
