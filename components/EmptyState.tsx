"use client";

type EmptyStateProps = {
  title: string;
  description: string;
};

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="rounded-3xl border border-dashed border-amber-300 bg-white/80 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/70">
      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-300">{description}</p>
    </section>
  );
}
