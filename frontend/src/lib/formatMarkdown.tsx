import type { ReactNode } from "react";

/**
 * Formats markdown-like text into React elements.
 * Supports: **bold**, *italic*, numbered lists, bullet lists, and line breaks.
 */
export function formatMarkdown(text: string): ReactNode[] {
  const lines = text.split(/\n/);
  const elements: ReactNode[] = [];
  let listItems: ReactNode[] = [];
  let listType: "ol" | "ul" | null = null;
  let keyCounter = 0;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType;
      elements.push(
        <ListTag key={keyCounter++} className="my-2 list-inside space-y-1">
          {listItems}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  const parseInline = (str: string): ReactNode => {
    const parts: ReactNode[] = [];
    let remaining = str;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const italicMatch = remaining.match(/\*(.+?)\*/);

      let match: RegExpMatchArray | null = null;
      let matchIndex = Infinity;
      let format: "bold" | "italic" = "bold";

      if (boldMatch && boldMatch.index !== undefined) {
        matchIndex = boldMatch.index;
        match = boldMatch;
        format = "bold";
      }
      if (italicMatch && italicMatch.index !== undefined && italicMatch.index < matchIndex) {
        matchIndex = italicMatch.index;
        match = italicMatch;
        format = "italic";
      }

      if (match && match.index !== undefined) {
        if (match.index > 0) {
          parts.push(
            <span key={key++}>{remaining.slice(0, match.index)}</span>
          );
        }
        parts.push(
          format === "bold" ? (
            <strong key={key++}>{match[1]}</strong>
          ) : (
            <em key={key++}>{match[1]}</em>
          )
        );
        remaining = remaining.slice(match.index + match[0].length);
      } else {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
    }

    return <>{parts}</>;
  };

  const numberedListRegex = /^(\d+)\.\s+(.+)$/;
  const bulletListRegex = /^[\*\-]\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      flushList();
      elements.push(<br key={keyCounter++} />);
      continue;
    }

    const numberedMatch = trimmed.match(numberedListRegex);
    const bulletMatch = trimmed.match(bulletListRegex);

    if (numberedMatch) {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listItems.push(
        <li key={listItems.length} className="ml-2">
          {parseInline(numberedMatch[2])}
        </li>
      );
      continue;
    }

    if (bulletMatch) {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listItems.push(
        <li key={listItems.length} className="ml-2">
          {parseInline(bulletMatch[1])}
        </li>
      );
      continue;
    }

    flushList();
    elements.push(
      <p key={keyCounter++} className="mb-1 last:mb-0">
        {parseInline(trimmed)}
      </p>
    );
  }

  flushList();
  return elements;
}
