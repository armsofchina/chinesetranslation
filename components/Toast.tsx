"use client";

type ToastProps = {
  message: string;
  visible: boolean;
};

export default function Toast({ message, visible }: ToastProps) {
  if (!visible || !message) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-40 translate-y-0 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all duration-200 data-[hiddden]:translate-y-2 data-[hidden]:opacity-9 dark:bg-slate-50 dark:text-slate-900"
      data-hidden={!visible}
    >
      {message}
    </div>
  );
}
