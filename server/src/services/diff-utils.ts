import type { PostAnchor } from "../../../shared/types";

export interface FilePatch {
  file: string;
  oldFile: string;
  newFile: string;
  patch: string;
}

export interface LineRange {
  start: number;
  end: number;
}

export interface AnchorFinding {
  file: string;
  startLine: number | null;
  endLine: number | null;
  side: "LEFT" | "RIGHT";
}

const DIFF_HEADER_RE = /^diff --git a\/(.+?) b\/(.+)$/;
const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function splitUnifiedDiff(diff: string): FilePatch[] {
  const files: FilePatch[] = [];
  let current: string[] = [];
  let currentFile: string | null = null;
  let currentOld = "";
  let currentNew = "";

  const flush = () => {
    if (currentFile !== null) {
      files.push({ file: currentFile, oldFile: currentOld, newFile: currentNew, patch: current.join("\n") });
    }
    current = [];
  };

  for (const line of diff.split("\n")) {
    const header = line.match(DIFF_HEADER_RE);
    if (header) {
      flush();
      currentOld = header[1];
      currentNew = header[2];
      currentFile = currentNew !== "/dev/null" ? currentNew : currentOld;
    }
    current.push(line);
  }
  flush();

  return files;
}

export function diffHunkRanges(patch: string, side: "LEFT" | "RIGHT"): LineRange[] {
  const ranges: LineRange[] = [];

  for (const line of patch.split("\n")) {
    const match = line.match(HUNK_HEADER_RE);
    if (!match) continue;

    const start = side === "LEFT" ? Number(match[1]) : Number(match[3]);
    const countRaw = side === "LEFT" ? match[2] : match[4];
    const count = countRaw !== undefined ? Number(countRaw) : 1;

    if (count > 0) {
      ranges.push({ start, end: start + count - 1 });
    }
  }

  return ranges;
}

const ADJACENT_LINE_TOLERANCE = 3;

export function resolvePostAnchor(finding: AnchorFinding, ranges: LineRange[], fileInDiff: boolean): PostAnchor {
  if (!fileInDiff) {
    return { kind: "pull-request", line: null, startLine: null, adjusted: false };
  }

  const line = finding.endLine ?? finding.startLine;
  if (line === null || line === undefined) {
    return { kind: "file", line: null, startLine: null, adjusted: false };
  }

  const containing = ranges.find((r) => line >= r.start && line <= r.end);
  if (containing) {
    return { kind: "line", line, startLine: finding.startLine ?? null, adjusted: false };
  }

  if (ranges.length === 0) {
    return { kind: "file", line: null, startLine: null, adjusted: false };
  }

  let nearest = ranges[0];
  let nearestDist = Math.min(Math.abs(line - nearest.start), Math.abs(line - nearest.end));
  for (const r of ranges.slice(1)) {
    const dist = line < r.start ? r.start - line : line > r.end ? line - r.end : 0;
    if (dist < nearestDist) {
      nearest = r;
      nearestDist = dist;
    }
  }

  if (nearestDist <= ADJACENT_LINE_TOLERANCE) {
    const adjustedLine = line < nearest.start ? nearest.start : nearest.end;
    return { kind: "line", line: adjustedLine, startLine: null, adjusted: true };
  }

  return { kind: "file", line: null, startLine: null, adjusted: false };
}

export function findPatchForFile(patches: FilePatch[], file: string): FilePatch | undefined {
  return patches.find((p) => p.file === file || p.oldFile === file);
}
