import { TranslationDomain } from "@/lib/prompts";
import { DocumentFormat, TranslationChunk } from "@/lib/types";

export type TranslationHistoryInputMode = "document" | "image" | "text";

export type TranslationHistoryEntry = {
  id: string;
  savedAt: number;
  sourceLabel: string;
  inputMode: TranslationHistoryInputMode;
  documentFormat?: DocumentFormat;
  domain: TranslationDomain;
  usedModel: string;
  sourceCharacters: number;
  unitCount: number;
  unitLabel: string;
  chunks: TranslationChunk[];
  approvedChunkIds: string[];
};

const DATABASE_NAME = "translation-vibe-history";
const STORE_NAME = "entries";
const MAX_ENTRIES = 25;

const hash = (value: string): string => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
};

/**
 * Stable id for a source: re-translating or resuming the same source updates
 * its entry instead of duplicating it. Translation-independent on purpose so
 * post-completion edits keep the original id.
 */
export const makeHistoryEntryId = (sourceLabel: string, chunks: TranslationChunk[]): string => {
  const fingerprint = chunks.map((chunk) => `${chunk.id}:${chunk.originalChinese.length}`).join("|");
  return hash(`${sourceLabel}#${fingerprint}`);
};

/** Chunks as stored in history: QA reports are dropped (rebuilt on restore). */
export const toHistoryChunks = (chunks: TranslationChunk[]): TranslationChunk[] =>
  chunks.map((chunk) => ({
    id: chunk.id,
    pageNumber: chunk.pageNumber,
    originalChinese: chunk.originalChinese,
    translatedEnglish: chunk.translatedEnglish,
    reviewNote: chunk.reviewNote,
    translationMemoryHit: chunk.translationMemoryHit
  }));

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open translation history."));
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Translation history operation failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Translation history operation failed."));
    };
  });
};

const storageAvailable = (): boolean => typeof window !== "undefined" && Boolean(window.indexedDB);

export const saveTranslationHistoryEntry = async (entry: TranslationHistoryEntry): Promise<void> => {
  if (!storageAvailable()) {
    return;
  }
  await withStore<IDBValidKey>("readwrite", (store) => store.put(entry));

  // FIFO eviction beyond the cap.
  const all = await withStore<TranslationHistoryEntry[]>("readonly", (store) => store.getAll() as IDBRequest<TranslationHistoryEntry[]>);
  if (all.length <= MAX_ENTRIES) {
    return;
  }
  const stalestFirst = [...all].sort((left, right) => left.savedAt - right.savedAt);
  const evictIds = stalestFirst.slice(0, all.length - MAX_ENTRIES).map((entry) => entry.id);
  await withStore<number>("readwrite", (store) => {
    for (const id of evictIds) {
      store.delete(id);
    }
    return store.count();
  });
};

export const listTranslationHistory = async (): Promise<TranslationHistoryEntry[]> => {
  if (!storageAvailable()) {
    return [];
  }
  const all = await withStore<TranslationHistoryEntry[]>("readonly", (store) => store.getAll() as IDBRequest<TranslationHistoryEntry[]>);
  return all.sort((left, right) => right.savedAt - left.savedAt);
};

export const deleteTranslationHistoryEntry = async (id: string): Promise<void> => {
  if (!storageAvailable()) {
    return;
  }
  await withStore<undefined>("readwrite", (store) => store.delete(id));
};

export const clearTranslationHistory = async (): Promise<void> => {
  if (!storageAvailable()) {
    return;
  }
  await withStore<undefined>("readwrite", (store) => store.clear());
};
