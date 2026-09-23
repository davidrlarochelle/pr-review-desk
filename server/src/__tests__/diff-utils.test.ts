import { describe, expect, it } from "vitest";
import { diffHunkRanges, resolvePostAnchor, splitUnifiedDiff } from "../services/diff-utils";

const MULTI_FILE_DIFF = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,4 @@
 line1
+line1.5
 line2
 line3
@@ -10,2 +11,3 @@
 line10
+line10.5
diff --git a/src/b.ts b/src/b.ts
index 3333333..4444444 100644
--- a/src/b.ts
+++ b/src/b.ts
@@ -5,1 +5,1 @@
-old
+new
`;

describe("splitUnifiedDiff", () => {
  it("splits a multi-file diff into per-file patches", () => {
    const patches = splitUnifiedDiff(MULTI_FILE_DIFF);

    expect(patches).toHaveLength(2);
    expect(patches[0].file).toBe("src/a.ts");
    expect(patches[0].patch).toContain("@@ -1,3 +1,4 @@");
    expect(patches[0].patch).toContain("@@ -10,2 +11,3 @@");
    expect(patches[1].file).toBe("src/b.ts");
    expect(patches[1].patch).toContain("-old");
    expect(patches[1].patch).toContain("+new");
  });
});

describe("diffHunkRanges", () => {
  it("extracts line ranges for the RIGHT side from a patch", () => {
    const patches = splitUnifiedDiff(MULTI_FILE_DIFF);
    const ranges = diffHunkRanges(patches[0].patch, "RIGHT");

    expect(ranges).toEqual([
      { start: 1, end: 4 },
      { start: 11, end: 13 },
    ]);
  });

  it("extracts line ranges for the LEFT side from a patch", () => {
    const patches = splitUnifiedDiff(MULTI_FILE_DIFF);
    const ranges = diffHunkRanges(patches[0].patch, "LEFT");

    expect(ranges).toEqual([
      { start: 1, end: 3 },
      { start: 10, end: 11 },
    ]);
  });
});

describe("resolvePostAnchor", () => {
  const patches = splitUnifiedDiff(MULTI_FILE_DIFF);
  const ranges = diffHunkRanges(patches[0].patch, "RIGHT");

  it("anchors to a line when the finding falls inside a hunk", () => {
    const anchor = resolvePostAnchor({ file: "src/a.ts", startLine: 2, endLine: 2, side: "RIGHT" }, ranges, true);
    expect(anchor).toEqual({ kind: "line", line: 2, startLine: 2, adjusted: false });
  });

  it("falls back to a file anchor when the finding is outside all hunks", () => {
    const anchor = resolvePostAnchor({ file: "src/a.ts", startLine: 500, endLine: 500, side: "RIGHT" }, ranges, true);
    expect(anchor.kind).toBe("file");
    expect(anchor.line).toBeNull();
  });

  it("falls back to a pull-request anchor when the file is not part of the diff", () => {
    const anchor = resolvePostAnchor({ file: "src/missing.ts", startLine: 1, endLine: 1, side: "RIGHT" }, [], false);
    expect(anchor).toEqual({ kind: "pull-request", line: null, startLine: null, adjusted: false });
  });
});
