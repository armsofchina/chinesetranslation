"use client";

type EmptyStateProps = {
  title: string;
  description: string;
};

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="rounded-2xl bg-white/60 px-6 py-14 text-center dark:bg-slate-900/50">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-slate-400 dark:text-slate-500">{description}</p>
    </section>
  );
}
