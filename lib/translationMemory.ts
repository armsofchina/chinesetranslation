import { TranslationDomain } from "@/lib/prompts";

type TranslationMemoryRecord = {
  key: string;
  source: string;
  target: string;
  domain: TranslationDomain;
  glossarySignature: string;
  updatedAt: number;
};

const DATABASE_NAME = "translation-vibe-memory";
const STORE_NAME = "segments";

const normalizeSource = (source: string): string => source.replace(/\r\n/g, "\n").trim();

const glossarySignature = (glossary: Record<string, string>): string =>
  Object.entries(glossary)
    .map(([source, target]) => [source.trim(), target.trim()] as const)
    .filter(([source, target]) => source && target)
    .sort(([left], [right]) => left.localeCompare(right, "zh-Hans-CN"))
    .map(([source, target]) => `${source}\u0000${target}`)
    .join("\u0001");

const hash = (value: string): string => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
};

const getKey = (source: string, domain: TranslationDomain, glossary: Record<string, string>): string =>
  hash(`${domain}\u0002${glossarySignature(glossary)}\u0002${normalizeSource(source)}`);

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open translation memory."));
  });

const runRequest = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Translation memory operation failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Translation memory operation failed."));
    };
  });
};

export const findTranslationMemory = async (
  source: string,
  domain: TranslationDomain,
  glossary: Record<string, string>
): Promise<string | undefined> => {
  if (typeof window === "undefined" || !window.indexedDB) return undefined;
  const normalized = normalizeSource(source);
  const signature = glossarySignature(glossary);
  const record = await runRequest<TranslationMemoryRecord | undefined>("readonly", (store) =>
    store.get(getKey(normalized, domain, glossary))
  );
  return record?.source === normalized && record.domain === domain && record.glossarySignature === signature
    ? record.target
    : undefined;
};

export const rememberTranslation = async (
  source: string,
  target: string,
  domain: TranslationDomain,
  glossary: Record<string, string>
): Promise<void> => {
  if (typeof window === "undefined" || !window.indexedDB || !target.trim()) return;
  const normalized = normalizeSource(source);
  const record: TranslationMemoryRecord = {
    key: getKey(normalized, domain, glossary),
    source: normalized,
    target: target.trim(),
    domain,
    glossarySignature: glossarySignature(glossary),
    updatedAt: Date.now()
  };
  await runRequest<IDBValidKey>("readwrite", (store) => store.put(record));
};
