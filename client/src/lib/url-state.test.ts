import { beforeEach, describe, expect, it } from "vitest";
import {
  forgetLocalRepo,
  loadPrFilters,
  loadPrOrder,
  parseSearch,
  rememberedLocalRepo,
  rememberedPrList,
  reviewRepoFromSegment,
  reviewRepoSegment,
  saveLocalSelection,
  savePrList,
  savePrOrder,
  stringifySearch,
  validatePrListSearch,
} from "./url-state";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

beforeEach(() => {
  (globalThis as { window?: unknown }).window = { localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage() };
});

describe("search round trip", () => {
  it("keeps repeated keys as lists and values with commas intact", () => {
    const search = { repo: "org:Villeco-inc", label: ["needs review", "a,b"], sort: "updated" };
    const parsed = validatePrListSearch(parseSearch(stringifySearch(search)));
    expect(parsed).toEqual({ ...search, author: undefined, status: undefined, dir: undefined });
  });

  it("drops empty values and unknown enum members", () => {
    expect(stringifySearch({ repo: "", author: [], sort: undefined })).toBe("");
    expect(validatePrListSearch({ status: ["draft", "bogus"], sort: "size", dir: "up" })).toEqual({
      repo: undefined,
      author: undefined,
      status: ["draft"],
      label: undefined,
      sort: undefined,
      dir: undefined,
    });
  });

  it("treats a single value as a one-item list", () => {
    expect(validatePrListSearch(parseSearch("?author=alice")).author).toEqual(["alice"]);
  });
});

describe("list memory", () => {
  it("restores the last repo with that repo's own filters", () => {
    savePrList({ repo: "Villeco-inc/villeco", label: ["bug"], sort: "updated" });
    savePrList({ repo: "Villeco-inc/linea-web", author: ["bob"] });
    expect(rememberedPrList()).toEqual({ repo: "Villeco-inc/linea-web", ...loadPrFilters("Villeco-inc/linea-web") });
    expect(loadPrFilters("Villeco-inc/villeco")).toMatchObject({ label: ["bug"], sort: "updated" });
    expect(loadPrFilters("Villeco-inc/villeco").author).toBeUndefined();
  });

  it("remembers nothing until a repo is chosen", () => {
    expect(rememberedPrList()).toBeNull();
  });

  it("forgets a local repo so /local stops redirecting to it", () => {
    saveLocalSelection("villeco", { branch: "feat/x", base: "main" });
    expect(rememberedLocalRepo()).toBe("villeco");
    forgetLocalRepo("villeco");
    expect(rememberedLocalRepo()).toBeNull();
  });
});

describe("pager order and local ids", () => {
  it("keeps only well-formed entries", () => {
    savePrOrder([{ repo: "a/b", number: 1 }]);
    expect(loadPrOrder()).toEqual([{ repo: "a/b", number: 1 }]);
  });

  it("maps local review repos to a slash-free segment and back", () => {
    expect(reviewRepoSegment("local/villeco-9f2c1a0b3d")).toBe("villeco-9f2c1a0b3d");
    expect(reviewRepoFromSegment("villeco-9f2c1a0b3d")).toBe("local/villeco-9f2c1a0b3d");
  });
});
