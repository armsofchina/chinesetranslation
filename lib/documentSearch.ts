export type DocumentSearchSide = "source" | "translation";

export type DocumentSearchMatch = {
  pageNumber: number;
  side: DocumentSearchSide;
  occurrence: number;
};

export const normalizeDocumentSearchQuery = (query: string): string => query.trim();

export const countDocumentSearchMatches = (text: string, query: string): number => {
  const normalizedQuery = normalizeDocumentSearchQuery(query).toLocaleLowerCase();
  if (!normalizedQuery) {
    return 0;
  }

  const normalizedText = text.toLocaleLowerCase();
  let count = 0;
  let cursor = 0;
  while (cursor <= normalizedText.length - normalizedQuery.length) {
    const matchIndex = normalizedText.indexOf(normalizedQuery, cursor);
    if (matchIndex === -1) {
      break;
    }
    count += 1;
    cursor = matchIndex + normalizedQuery.length;
  }
  return count;
};

export const createDocumentSearchMatches = (
  pageNumber: number,
  side: DocumentSearchSide,
  text: string,
  query: string
): DocumentSearchMatch[] =>
  Array.from({ length: countDocumentSearchMatches(text, query) }, (_, occurrence) => ({
    pageNumber,
    side,
    occurrence
  }));
