/**
 * Scores an item for the ⌘K palette. Every whitespace-separated token of the query must appear
 * in the title or the meta line (case-insensitive); returns null when one is missing.
 * Higher is better: title prefix > all tokens in the title > matched through the meta line.
 */
export function matchScore(query: string, title: string, meta: string): number | null {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const t = title.toLowerCase();
  const haystack = `${t} ${meta.toLowerCase()}`;
  if (!tokens.every((tok) => haystack.includes(tok))) return null;
  if (t.startsWith(query.trim().toLowerCase())) return 3;
  if (tokens.every((tok) => t.includes(tok))) return 2;
  return 1;
}

/** Keeps the items that match, best first; ties keep their original order. */
export function rank<T>(items: T[], query: string, fields: (item: T) => [title: string, meta: string]): T[] {
  return items
    .map((item, i) => ({ item, i, score: matchScore(query, ...fields(item)) }))
    .filter((r): r is { item: T; i: number; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((r) => r.item);
}
