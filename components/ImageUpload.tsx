"use client";

import { useId, useState } from "react";

type ImageUploadProps = {
  fileName?: string;
  onFileSelect: (file: File | null) => void;
};

export default function ImageUpload({ fileName, onFileSelect }: ImageUploadProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  return (
    <section>
      <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100" htmlFor={inputId}>
        Upload Image
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/bmp,image/tiff"
        onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
        className="sr-only"
      />

      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files?.[0];
          onFileSelect(file ?? null);
        }}
        className={`mt-3 block cursor-pointer rounded-3xl border-2 border-dashed px-6 py-10 text-center transition focus-within:ring-2 focus-within:ring-sky-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-900 ${
          isDragging
            ? "border-amber-500 bg-amber-100/70 dark:bg-amber-900/30"
            : "border-amber-200 bg-white/90 hover:border-amber-400 hover:bg-amber-50/80 dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-amber-500 dark:hover:bg-amber-900/20"
        }`}
      >
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Drop a scan, screenshot, or photo here</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">or click to browse image files</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <p className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            PNG / JPG / WEBP / BMP / TIFF
          </p>
          <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            OCR first
          </p>
        </div>
      </label>

      {fileName ? (
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
          Selected image: <span className="font-medium">{fileName}</span>
        </p>
      ) : null}

      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
        Best for screenshots and scans. OCR quality depends on contrast, crop quality, and whether text is obscured.
      </p>
    </section>
  );
}
