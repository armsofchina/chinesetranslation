"use client";

type ErrorStateProps = {
  message: string;
};

export default function ErrorState({ message }: ErrorStateProps) {
  if (!message) {
    return null;
  }

  const hints = [
    "Check whether your OpenRouter key is valid and has available credits.",
    "If rate-limited, wait briefly and retry.",
    "If using PDF mode, confirm the file contains selectable text."
  ];

  return (
    <section className="rounded-2xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
      <p className="text-sm font-semibold text-rose-800 dark:text-rose-100">Translation issue</p>
      <p className="mt-1 text-sm text-rose-700 dark:text-rose-200">{message}</p>
      <div className="mt-3 space-y-1">
        {hints.map((hint) => (
          <p key={hint} className="text-xs text-rose-700 dark:text-rose-300">
            - {hint}
          </p>
        ))}
      </div>
    </section>
  );
}
