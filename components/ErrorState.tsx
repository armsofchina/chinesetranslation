"use client";

type ErrorStateProps = {
  message: string;
};

export default function ErrorState({ message }: ErrorStateProps) {
  if (!message) {
    return null;
  }

  return (
    <section className="rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-950/20">
      <p className="text-xs font-medium text-rose-700 dark:text-rose-300">{message}</p>
    </section>
  );
}
