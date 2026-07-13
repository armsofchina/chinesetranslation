import { ExtractedEntity } from "@/lib/extractEntities";
import { TranslationDomain } from "@/lib/prompts";
import { ExtractedPdfPage, TranslationChunk, TranslationPage } from "@/lib/types";

export type SavedGlossaryEntry = {
  chinese: string;
  english: string;
  locked: boolean;
  confirmed: boolean;
};

export type WorkspaceSnapshot = {
  version: 1;
  savedAt: number;
  inputMode: "pdf" | "image" | "text";
  pdfName?: string;
  pdfFile?: File;
  pdfPages: ExtractedPdfPage[];
  pdfTotalPages: number;
  pdfScannedMessage: string;
  imageName?: string;
  imageDataUrl?: string;
  pastedText: string;
  translatedChunks: TranslationChunk[];
  translationPages: TranslationPage[];
  domain: TranslationDomain;
  glossaryEntries: SavedGlossaryEntry[];
  extractedEntities: ExtractedEntity[];
  usedModel: string;
  approvedChunkIds: string[];
  translationStale: boolean;
  canResume: boolean;
};

const DATABASE_NAME = "translation-vibe-workspace";
const STORE_NAME = "workspace";
const CURRENT_KEY = "current";

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open workspace storage."));
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
    request.onerror = () => reject(request.error ?? new Error("Workspace storage failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Workspace storage failed."));
    };
  });
};

export const loadWorkspaceSnapshot = async (): Promise<WorkspaceSnapshot | undefined> => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return undefined;
  }
  return withStore<WorkspaceSnapshot | undefined>("readonly", (store) => store.get(CURRENT_KEY));
};

export const saveWorkspaceSnapshot = async (snapshot: WorkspaceSnapshot): Promise<void> => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return;
  }
  await withStore<IDBValidKey>("readwrite", (store) => store.put(snapshot, CURRENT_KEY));
};

export const clearWorkspaceSnapshot = async (): Promise<void> => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return;
  }
  await withStore<undefined>("readwrite", (store) => store.delete(CURRENT_KEY));
};
