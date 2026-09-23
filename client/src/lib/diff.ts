export interface DiffLine {
  type: "add" | "del" | "context" | "hunk";
  oldLine: number | null;
  newLine: number | null;
  content: string;
}

export function parsePatch(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  // Only lines inside a hunk are code. Git file headers (diff --git, index, ---, +++, mode lines)
  // come before the first @@ and would otherwise be read as context, add and del lines.
  let inHunk = false;

  const raws = patch.split("\n");
  // A trailing newline yields one empty string that is not a line of the file.
  if (raws.length > 0 && raws[raws.length - 1] === "") raws.pop();

  for (const raw of raws) {
    if (raw.startsWith("diff --git ")) {
      inHunk = false;
      continue;
    }
    if (raw.startsWith("@@")) {
      const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      inHunk = true;
      lines.push({ type: "hunk", oldLine: null, newLine: null, content: raw });
      continue;
    }
    if (!inHunk) continue;
    if (raw.startsWith("+")) {
      lines.push({ type: "add", oldLine: null, newLine, content: raw.slice(1) });
      newLine += 1;
    } else if (raw.startsWith("-")) {
      lines.push({ type: "del", oldLine, newLine: null, content: raw.slice(1) });
      oldLine += 1;
    } else if (raw.startsWith("\\")) {
      continue;
    } else {
      lines.push({ type: "context", oldLine, newLine, content: raw.slice(1) });
      oldLine += 1;
      newLine += 1;
    }
  }

  return lines;
}
