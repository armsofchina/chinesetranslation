"use client";

import { useEffect, useMemo, useState } from "react";
import { ExtractedEntity } from "@/lib/extractEntities";

export type GlossaryEntry = {
  chinese: string;
  english: string;
  locked: boolean;
  confirmed: boolean;
};

type EntityGlossaryProps = {
  /** Automatically extracted entities from the source text. */
  extracted: ExtractedEntity[];
  /** User-edited glossary entries. */
  entries: GlossaryEntry[];
  onEntriesChange: (entries: GlossaryEntry[]) => void;
  open: boolean;
  onClose: () => void;
};

const TYPE_LABEL: Record<ExtractedEntity["type"], string> = {
  person: "Person",
  place: "Place",
  organization: "Org",
  title: "Title",
  term: "Term",
  other: "Other"
};

const TYPE_DOT: Record<ExtractedEntity["type"], string> = {
  person: "bg-sky-500",
  place: "bg-emerald-500",
  organization: "bg-amber-500",
  title: "bg-violet-500",
  term: "bg-rose-500",
  other: "bg-slate-400"
};

export default function EntityGlossary({ extracted, entries, onEntriesChange, open, onClose }: EntityGlossaryProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftEnglish, setDraftEnglish] = useState("");
  const [filter, setFilter] = useState<ExtractedEntity["type"] | "all">("all");
  const [search, setSearch] = useState("");
  const [newChinese, setNewChinese] = useState("");
  const [newEnglish, setNewEnglish] = useState("");
  const [newLocked, setNewLocked] = useState(true);

  // Merge freshly extracted entities with current entries without overwriting locks.
  const merged = useMemo(() => {
    const map = new Map<string, GlossaryEntry>();

    // Start with existing locked entries so we never lose them.
    for (const entry of entries) {
      map.set(entry.chinese, { ...entry });
    }

    // Merge extracted entities.
    for (const entity of extracted) {
      const existing = map.get(entity.chinese);
      if (existing) {
        // Only update english suggestion if not locked and not yet confirmed.
        if (!existing.locked && !existing.confirmed) {
          map.set(entity.chinese, {
            ...existing,
            english: entity.english || existing.english || ""
          });
        }
      } else {
        map.set(entity.chinese, {
          chinese: entity.chinese,
          english: entity.english || "",
          locked: false,
          confirmed: false
        });
      }
    }

    // Preserve any entries that don't match extracted but were manually added.
    for (const entry of entries) {
      if (!map.has(entry.chinese)) {
        map.set(entry.chinese, { ...entry });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.chinese.localeCompare(b.chinese, "zh-Hans-CN"));
  }, [entries, extracted]);

  // Push merged back up when it stabilizes.
  useEffect(() => {
    const changed =
      merged.length !== entries.length ||
      merged.some((m, i) => {
        const e = entries[i];
        return !e || m.chinese !== e.chinese || m.english !== e.english || m.locked !== e.locked || m.confirmed !== e.confirmed;
      });
    if (changed) {
      onEntriesChange(merged);
    }
  }, [entries, merged, onEntriesChange]);

  useEffect(() => {
    if (!open) {
      setEditingIndex(null);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    return merged.filter((entry) => {
      const match = extracted.find((ex) => ex.chinese === entry.chinese);
      const matchesFilter = filter === "all" ? true : match?.type === filter;
      const normalizedSearch = search.trim().toLowerCase();
      const matchesSearch = normalizedSearch
        ? entry.chinese.toLowerCase().includes(normalizedSearch) || entry.english.toLowerCase().includes(normalizedSearch)
        : true;
      return matchesFilter && matchesSearch;
    });
  }, [merged, filter, extracted, search]);

  const lockedCount = merged.filter((e) => e.locked).length;
  const confirmedCount = merged.filter((e) => Boolean(e.english.trim())).length;

  const handleLockToggle = (index: number) => {
    const next = [...merged];
    next[index] = { ...next[index], locked: !next[index].locked, confirmed: true };
    onEntriesChange(next);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setDraftEnglish(merged[index].english);
  };

  const handleSaveEdit = (index: number) => {
    const next = [...merged];
    next[index] = { ...next[index], english: draftEnglish.trim(), confirmed: true };
    onEntriesChange(next);
    setEditingIndex(null);
  };

  const handleAddCustom = () => {
    const trimmedChinese = newChinese.trim();
    const trimmedEnglish = newEnglish.trim();
    if (!trimmedChinese) {
      return;
    }

    const next = [
      ...merged.filter((entry) => entry.chinese !== trimmedChinese),
      {
        chinese: trimmedChinese,
        english: trimmedEnglish,
        locked: newLocked,
        confirmed: true
      }
    ];
    onEntriesChange(next);
    setNewChinese("");
    setNewEnglish("");
    setNewLocked(true);
  };

  const handleRemove = (index: number) => {
    const next = merged.filter((_, i) => i !== index);
    onEntriesChange(next);
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleLockFilled = () => {
    const next = merged.map((entry) =>
      entry.english.trim() ? { ...entry, locked: true, confirmed: true } : entry
    );
    onEntriesChange(next);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Translation glossary"
        className="absolute inset-y-0 right-0 flex w-full max-w-[28rem] flex-col border-l border-amber-200/70 bg-white/95 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-amber-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Translation Glossary</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Locked terms are enforced on future translation runs.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Close glossary"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {merged.length} total
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
              {lockedCount} locked
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              {confirmedCount} with translations
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Chinese or English terms..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-amber-900/50"
            />
            <div className="flex flex-wrap gap-1.5">
              {(["all", "person", "place", "organization", "title", "term", "other"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    filter === f
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {f === "all" ? "All" : TYPE_LABEL[f as ExtractedEntity["type"]]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleLockFilled}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Lock filled terms
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                  setSearch("");
                }}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            {filtered.map((entry, index) => {
              const originalIndex = merged.findIndex((item) => item.chinese === entry.chinese);
              const extractedMatch = extracted.find((ex) => ex.chinese === entry.chinese);

              return (
                <div
                  key={`${entry.chinese}-${index}`}
                  className={`rounded-2xl border p-3 transition ${
                    entry.locked
                      ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                            extractedMatch ? TYPE_DOT[extractedMatch.type] : "bg-slate-400"
                          }`}
                        />
                        <span className="cn-text text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {entry.chinese}
                        </span>
                        {extractedMatch ? (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {TYPE_LABEL[extractedMatch.type]}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            Custom
                          </span>
                        )}
                      </div>

                      {editingIndex === originalIndex ? (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="text"
                            value={draftEnglish}
                            onChange={(event) => setDraftEnglish(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") handleSaveEdit(originalIndex);
                              if (event.key === "Escape") setEditingIndex(null);
                            }}
                            autoFocus
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-amber-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                            placeholder="English translation..."
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(originalIndex)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(originalIndex)}
                          className="mt-1 block text-left text-sm leading-6 text-slate-600 hover:text-amber-700 dark:text-slate-300 dark:hover:text-amber-300"
                        >
                          {entry.english || (
                            <span className="italic text-slate-400 dark:text-slate-500">Click to add preferred English...</span>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleLockToggle(originalIndex)}
                        title={entry.locked ? "Unlock term" : "Lock term"}
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold transition ${
                          entry.locked
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        }`}
                      >
                        {entry.locked ? "Locked" : "Open"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(originalIndex)}
                        className="rounded-full px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                        title="Remove"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No glossary entries match this filter yet. Try translating first, or add a custom term below.
              </p>
            ) : null}
          </div>
        </div>

        <div className="border-t border-amber-100 px-5 py-4 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Add Custom Term
          </p>
          <div className="mt-3 grid gap-2">
            <input
              type="text"
              value={newChinese}
              onChange={(event) => setNewChinese(event.target.value)}
              placeholder="Chinese source term"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-amber-900/50"
            />
            <input
              type="text"
              value={newEnglish}
              onChange={(event) => setNewEnglish(event.target.value)}
              placeholder="Preferred English translation"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-amber-900/50"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={newLocked}
                onChange={(event) => setNewLocked(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Lock this translation for future runs
            </label>
            <button
              type="button"
              onClick={handleAddCustom}
              disabled={!newChinese.trim()}
              className="w-full rounded-xl border border-dashed border-slate-300 bg-white py-2 text-xs font-medium text-slate-600 transition hover:border-amber-400 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-amber-500 dark:hover:bg-amber-950/30"
            >
              Save custom term
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
