import { describe, expect, it } from "vitest";
import { matchScore, rank } from "./search";

describe("matchScore", () => {
  it("matches every token across title and meta, in any order", () => {
    expect(matchScore("api 2754", "fix: cap the start", "api #2754 · AliceMartin")).not.toBeNull();
    expect(matchScore("#2754", "fix: cap", "api #2754")).not.toBeNull();
  });

  it("rejects when one token is missing", () => {
    expect(matchScore("cap web", "fix: cap", "api #2754")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(matchScore("ABC-5140", "fix(abc-5140): cap", "")).not.toBeNull();
  });

  it("ranks a title prefix above a title match above a meta-only match", () => {
    expect(matchScore("fix", "fix: a", "")).toBe(3);
    expect(matchScore("cap", "fix: cap", "")).toBe(2);
    expect(matchScore("alicemartin", "fix: cap", "api #2754 · AliceMartin")).toBe(1);
  });

  it("scores an empty query as a match so the palette can show defaults", () => {
    expect(matchScore("  ", "anything", "")).toBe(0);
  });
});

describe("rank", () => {
  it("drops non-matches and sorts best first, keeping order on ties", () => {
    const items = [
      { t: "chore: bump puma", m: "api #1" },
      { t: "fix: puma crash", m: "api #2" },
      { t: "puma upgrade", m: "api #3" },
      { t: "docs", m: "api #4" },
    ];
    expect(rank(items, "puma", (i) => [i.t, i.m]).map((i) => i.m)).toEqual(["api #3", "api #1", "api #2"]);
  });
});
