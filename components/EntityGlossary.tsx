"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExtractedEntity } from "@/lib/extractEntities";

export type GlossaryEntry = {
  chinese: string;
  english: string;
  locked: boolean;
  confirmed: boolean;
};

type EntityGlossaryProps = {
  extracted: ExtractedEntity[];
  entries: GlossaryEntry[];
  onEntriesChange: (entries: GlossaryEntry[]) => void;
  open: boolean;
  onClose: () => void;
  onDismissExtracted?: (chinese: string) => void;
};

const TYPE_DOT: Record<ExtractedEntity["type"], string> = {
  person: "bg-sky-400",
  place: "bg-emerald-400",
  organization: "bg-amber-400",
  title: "bg-violet-400",
  term: "bg-rose-400",
  other: "bg-slate-400"
};

export default function EntityGlossary({ extracted, entries, onEntriesChange, open, onClose, onDismissExtracted }: EntityGlossaryProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftChinese, setDraftChinese] = useState("");
  const [draftEnglish, setDraftEnglish] = useState("");
  const [filter, setFilter] = useState<ExtractedEntity["type"] | "all">("all");
  const importRef = useRef<HTMLInputElement | null>(null);

  const merged = useMemo(() => {
    const map = new Map<string, GlossaryEntry>();
    for (const entry of entries) map.set(entry.chinese, { ...entry });
    for (const entity of extracted) {
      const existing = map.get(entity.chinese);
      if (existing) {
        if (!existing.locked && !existing.confirmed) {
          map.set(entity.chinese, { ...existing, english: entity.english || existing.english || "" });
        }
      } else {
        map.set(entity.chinese, { chinese: entity.chinese, english: entity.english || "", locked: false, confirmed: false });
      }
    }
    for (const entry of entries) if (!map.has(entry.chinese)) map.set(entry.chinese, { ...entry });
    return Array.from(map.values()).sort((a, b) => a.chinese.localeCompare(b.chinese, "zh-Hans-CN"));
  }, [entries, extracted]);

  useEffect(() => {
    const changed = merged.length !== entries.length || merged.some((m, i) => {
      const e = entries[i];
      return !e || m.chinese !== e.chinese || m.english !== e.english || m.locked !== e.locked || m.confirmed !== e.confirmed;
    });
    if (changed) onEntriesChange(merged);
  }, [entries, merged, onEntriesChange]);

  const filtered = useMemo(() => {
    if (filter === "all") return merged;
    return merged.filter((e) => extracted.find((ex) => ex.chinese === e.chinese)?.type === filter);
  }, [merged, filter, extracted]);

  const lockedCount = merged.filter((e) => e.locked).length;

  const handleLockToggle = (index: number) => {
    const next = [...merged];
    next[index] = { ...next[index], locked: !next[index].locked, confirmed: true };
    onEntriesChange(next);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setDraftChinese(merged[index].chinese);
    setDraftEnglish(merged[index].english);
  };

  const handleSaveEdit = (index: number) => {
    const chinese = draftChinese.trim();
    if (!chinese) return;
    const next = [...merged];
    const priorChinese = next[index].chinese;
    next[index] = { ...next[index], chinese, english: draftEnglish.trim(), confirmed: true };
    onEntriesChange(Array.from(new Map(next.map((entry) => [entry.chinese, entry])).values()));
    if (priorChinese !== chinese) onDismissExtracted?.(priorChinese);
    setEditingIndex(null);
  };

  const handleAddCustom = () => {
    onEntriesChange([...merged, { chinese: "", english: "", locked: true, confirmed: true }]);
  };

  const handleRemove = (index: number) => {
    onDismissExtracted?.(merged[index].chinese);
    onEntriesChange(merged.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(merged, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "translation-glossary.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file?: File) => {
    if (!file || file.size > 1_000_000) return;
    try {
      const raw = await file.text();
      const parsed: unknown = file.name.toLowerCase().endsWith(".csv")
        ? raw.split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
            const [chinese = "", english = ""] = line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
            return { chinese, english, locked: true, confirmed: true };
          })
        : JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const imported = parsed.slice(0, 500).flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const candidate = value as Partial<GlossaryEntry>;
        const chinese = typeof candidate.chinese === "string" ? candidate.chinese.trim().slice(0, 200) : "";
        const english = typeof candidate.english === "string" ? candidate.english.trim().slice(0, 500) : "";
        return chinese ? [{ chinese, english, locked: candidate.locked !== false, confirmed: true }] : [];
      });
      onEntriesChange(Array.from(new Map([...merged, ...imported].map((entry) => [entry.chinese, entry])).values()));
    } catch {
      // Invalid imports leave the current glossary untouched.
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm dark:bg-black/40" onClick={onClose} />
      ) : null}

      {open ? <aside
        role="dialog"
        aria-modal="true"
        aria-label="Translation glossary"
        className="fixed inset-y-0 right-0 z-50 flex w-[min(94vw,560px)] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Glossary</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {lockedCount} locked · {merged.length} terms
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          {(["all", "person", "place", "organization", "title", "term", "other"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                filter === f
                  ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-2">
            {filtered.map((entry, index) => {
              const originalIndex = merged.findIndex((m) => m.chinese === entry.chinese);
              const extractedMatch = extracted.find((ex) => ex.chinese === entry.chinese);
              return (
                <div
                  key={`${entry.chinese}-${index}`}
                  className={`rounded-xl border p-2.5 transition ${
                    entry.locked
                      ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10"
                      : "border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${extractedMatch ? TYPE_DOT[extractedMatch.type] : "bg-slate-400"}`} />
                        <span className="cn-text text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {entry.chinese || "Custom"}
                        </span>
                      </div>
                      {editingIndex === originalIndex ? (
                        <div className="mt-1.5 grid gap-1.5">
                          <input
                            type="text"
                            value={draftChinese}
                            onChange={(e) => setDraftChinese(e.target.value)}
                            className="min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-amber-400 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                            placeholder="Chinese source term..."
                            aria-label="Chinese source term"
                          />
                          <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={draftEnglish}
                            onChange={(e) => setDraftEnglish(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(originalIndex); if (e.key === "Escape") setEditingIndex(null); }}
                            autoFocus
                            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-amber-400 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                            placeholder="English..."
                            aria-label="Approved English translation"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(originalIndex)}
                            className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-500"
                          >
                            Save
                          </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(originalIndex)}
                          className="mt-1 block text-left text-xs text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400"
                        >
                          {entry.english || <span className="italic text-slate-300 dark:text-slate-600">No translation set</span>}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleLockToggle(originalIndex)}
                        title={entry.locked ? "Unlock" : "Lock this translation"}
                        className={`rounded-md p-1 text-[11px] transition ${
                          entry.locked
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-300 hover:text-slate-500 dark:hover:text-slate-400"
                        }`}
                      >
                        {entry.locked ? (
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(originalIndex)}
                        className="rounded-md p-1 text-[11px] text-slate-300 transition hover:text-rose-500 dark:hover:text-rose-400"
                        title="Remove"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V4M7 4V3a1 1 0 0 1 1-1h0a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                No terms found. Upload a document or add manually.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <input ref={importRef} type="file" accept=".json,.csv,application/json,text/csv" className="hidden" onChange={(event) => void handleImport(event.target.files?.[0])} />
          <button
            type="button"
            onClick={handleAddCustom}
            className="rounded-lg border border-dashed border-slate-200 py-2 text-[11px] font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-300"
          >
            Add term
          </button>
          <button type="button" onClick={() => importRef.current?.click()} className="secondary-button text-xs">Import</button>
          <button type="button" onClick={handleExport} disabled={merged.length === 0} className="secondary-button text-xs">Export</button>
        </div>
      </aside> : null}
    </>
  );
}
