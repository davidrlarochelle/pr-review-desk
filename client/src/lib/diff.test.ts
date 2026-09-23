import { describe, expect, it } from "vitest";
import { parsePatch } from "./diff";

// Local reviews hand the viewer the raw `git diff` output, headers included.
const LOCAL_PATCH = `diff --git a/app/models/location.rb b/app/models/location.rb
index 765131529..fd29d7504 100644
--- a/app/models/location.rb
+++ b/app/models/location.rb
@@ -92,6 +92,8 @@ class Location < ApplicationRecord
   has_many :notes, as: :notable
+  has_many :location_flags, dependent: :destroy
 end
`;

// GitHub's per-file patch starts directly at the first hunk.
const GITHUB_PATCH = `@@ -1,2 +1,2 @@
-old
+new
 same`;

describe("parsePatch", () => {
  it("skips git file headers before the first hunk", () => {
    const lines = parsePatch(LOCAL_PATCH);
    expect(lines[0]).toMatchObject({ type: "hunk" });
    expect(lines.map((l) => l.content)).not.toContain("-- a/app/models/location.rb");
    expect(lines.map((l) => l.content)).not.toContain("iff --git a/app/models/location.rb b/app/models/location.rb");
  });

  it("numbers lines from the hunk header", () => {
    const lines = parsePatch(LOCAL_PATCH);
    expect(lines.slice(1)).toEqual([
      { type: "context", oldLine: 92, newLine: 92, content: "  has_many :notes, as: :notable" },
      { type: "add", oldLine: null, newLine: 93, content: "  has_many :location_flags, dependent: :destroy" },
      { type: "context", oldLine: 93, newLine: 94, content: "end" },
    ]);
  });

  it("does not turn the trailing newline into an extra context line", () => {
    const lines = parsePatch(LOCAL_PATCH);
    expect(lines[lines.length - 1].content).toBe("end");
  });

  it("still parses a patch that starts at the hunk", () => {
    expect(parsePatch(GITHUB_PATCH).map((l) => l.type)).toEqual(["hunk", "del", "add", "context"]);
  });

  it("resets at each file header in a multi-file diff", () => {
    const lines = parsePatch(`${LOCAL_PATCH}diff --git a/b.rb b/b.rb\nindex 1..2 100644\n--- a/b.rb\n+++ b/b.rb\n@@ -5 +5 @@\n-x\n+y\n`);
    expect(lines.filter((l) => l.type === "hunk")).toHaveLength(2);
    expect(lines.map((l) => l.content)).not.toContain("-- a/b.rb");
  });
});
