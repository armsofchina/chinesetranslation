"use client";

import { useEffect, useRef, useState } from "react";

type DragKind = "file" | "text";

type DropZoneOverlayProps = {
  /** When true, the overlay stays hidden but stray drops are still swallowed so the browser never navigates away. */
  disabled?: boolean;
  onFileDrop: (file: File) => void;
  onTextDrop: (text: string) => void;
};

const getDragKind = (event: DragEvent): DragKind | null => {
  const types = event.dataTransfer?.types;
  if (!types) {
    return null;
  }
  const list = Array.from(types);
  if (list.includes("Files")) {
    return "file";
  }
  if (list.includes("text/plain")) {
    return "text";
  }
  return null;
};

/**
 * Makes the whole window a drop target. While the user drags a file or text
 * selection over the app, a full-screen hint is shown; on drop, the payload is
 * routed to the appropriate handler. All stray dragover/drop defaults are
 * prevented so the browser can never navigate away and open the dropped file.
 */
export default function DropZoneOverlay({ disabled = false, onFileDrop, onTextDrop }: DropZoneOverlayProps) {
  const [dragKind, setDragKind] = useState<DragKind | null>(null);
  const fileDropRef = useRef(onFileDrop);
  const textDropRef = useRef(onTextDrop);

  useEffect(() => {
    fileDropRef.current = onFileDrop;
    textDropRef.current = onTextDrop;
  });

  useEffect(() => {
    if (disabled) {
      setDragKind(null);
    }
  }, [disabled]);

  useEffect(() => {
    // dragenter fires on the entered element before dragleave fires on the
    // previous one, so the depth only reaches zero when the pointer truly
    // leaves the window.
    let dragDepth = 0;

    const handleDragEnter = (event: DragEvent) => {
      const kind = getDragKind(event);
      if (!kind) {
        return;
      }
      event.preventDefault();
      dragDepth += 1;
      if (!disabled) {
        setDragKind(kind);
      }
    };

    const handleDragOver = (event: DragEvent) => {
      // Required so the drop event fires and the browser does not open the file.
      event.preventDefault();
      if (!disabled) {
        const kind = getDragKind(event);
        if (kind) {
          setDragKind((current) => current ?? kind);
        }
      }
    };

    const handleDragLeave = () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        setDragKind(null);
      }
    };

    const handleDrop = (event: DragEvent) => {
      dragDepth = 0;
      setDragKind(null);
      if (event.defaultPrevented) {
        // An inner drop zone (upload box, empty state) already handled this drop.
        return;
      }
      event.preventDefault();
      if (disabled) {
        return;
      }
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        fileDropRef.current(file);
        return;
      }
      const text = event.dataTransfer?.getData("text/plain") ?? "";
      if (text.trim()) {
        textDropRef.current(text);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [disabled]);

  if (!dragKind) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6 backdrop-blur-sm">
      <div className="flex min-h-[260px] w-full max-w-xl flex-col items-center justify-center rounded-2xl border-2 border-dashed border-sky-400 bg-white/95 px-8 py-12 text-center shadow-2xl dark:border-sky-500 dark:bg-slate-900/95">
        <p className="eyebrow">Drop anywhere</p>
        <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">
          {dragKind === "file" ? "Drop the file to load it" : "Drop the text to load it"}
        </p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
          {dragKind === "file"
            ? "PDF, DOCX, EPUB, PowerPoint, images, and .txt / .md files are detected automatically."
            : "The selected text will open in Paste Text mode, ready to translate."}
        </p>
      </div>
    </div>
  );
}
