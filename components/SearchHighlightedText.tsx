import { ReactNode } from "react";

type SearchHighlightedTextProps = {
  text: string;
  query?: string;
};

export default function SearchHighlightedText({ text, query = "" }: SearchHighlightedTextProps) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return <>{text}</>;
  }

  const normalizedText = text.toLocaleLowerCase();
  const normalizedNeedle = normalizedQuery.toLocaleLowerCase();
  const content: ReactNode[] = [];
  let cursor = 0;
  let matchNumber = 0;

  while (cursor <= normalizedText.length - normalizedNeedle.length) {
    const matchIndex = normalizedText.indexOf(normalizedNeedle, cursor);
    if (matchIndex === -1) {
      break;
    }
    if (matchIndex > cursor) {
      content.push(text.slice(cursor, matchIndex));
    }
    content.push(
      <mark key={`search-match-${matchNumber}`} data-search-match="true" className="search-highlight">
        {text.slice(matchIndex, matchIndex + normalizedNeedle.length)}
      </mark>
    );
    matchNumber += 1;
    cursor = matchIndex + normalizedNeedle.length;
  }

  if (cursor < text.length) {
    content.push(text.slice(cursor));
  }

  return <>{content}</>;
}
