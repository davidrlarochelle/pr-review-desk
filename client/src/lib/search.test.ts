import { describe, expect, it } from "vitest";
import { matchScore, rank } from "./search";

describe("matchScore", () => {
  it("matches every token across title and meta, in any order", () => {
    expect(matchScore("villeco 2754", "fix: plafonne le début", "villeco #2754 · AliceMartin")).not.toBeNull();
    expect(matchScore("#2754", "fix: plafonne", "villeco #2754")).not.toBeNull();
  });

  it("rejects when one token is missing", () => {
    expect(matchScore("plafonne linea-web", "fix: plafonne", "villeco #2754")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(matchScore("VIL-5140", "fix(vil-5140): plafonne", "")).not.toBeNull();
  });

  it("ranks a title prefix above a title match above a meta-only match", () => {
    expect(matchScore("fix", "fix: a", "")).toBe(3);
    expect(matchScore("plafonne", "fix: plafonne", "")).toBe(2);
    expect(matchScore("alicemartin", "fix: plafonne", "villeco #2754 · AliceMartin")).toBe(1);
  });

  it("scores an empty query as a match so the palette can show defaults", () => {
    expect(matchScore("  ", "anything", "")).toBe(0);
  });
});

describe("rank", () => {
  it("drops non-matches and sorts best first, keeping order on ties", () => {
    const items = [
      { t: "chore: bump puma", m: "villeco #1" },
      { t: "fix: puma crash", m: "villeco #2" },
      { t: "puma upgrade", m: "villeco #3" },
      { t: "docs", m: "villeco #4" },
    ];
    expect(rank(items, "puma", (i) => [i.t, i.m]).map((i) => i.m)).toEqual(["villeco #3", "villeco #1", "villeco #2"]);
  });
});
