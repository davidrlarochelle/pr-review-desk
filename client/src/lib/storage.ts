import { useEffect, useState } from "react";

type Area = "local" | "session";

function area(which: Area): Storage | null {
  try {
    return which === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // blocked storage: everything below degrades to in-memory defaults
  }
}

export function readStored<T>(which: Area, key: string): T | undefined {
  try {
    const raw = area(which)?.getItem(key);
    return raw == null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

export function writeStored(which: Area, key: string, value: unknown) {
  try {
    area(which)?.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode: the value still lives for this render tree.
  }
}

export function removeStored(which: Area, key: string) {
  try {
    area(which)?.removeItem(key);
  } catch {
    // nothing to clean up
  }
}

/**
 * useState that survives a refresh. Keyed per screen by the caller; a component whose
 * key changes should be remounted (the route components pass a React key) rather than
 * relying on this hook to swap stores mid-life.
 */
export function useStoredState<T extends object>(which: Area, key: string, initial: T) {
  const [value, setValue] = useState<T>(() => ({ ...initial, ...readStored<Partial<T>>(which, key) }));
  useEffect(() => writeStored(which, key, value), [which, key, value]);
  return [value, setValue] as const;
}

/** Review launch settings are a preference: shared by every review screen and kept across sessions. */
export const LAUNCH_KEY = "prd:launch";
export const LAUNCH_DEFAULTS = { model: "sonnet", effort: "standard", skills: "" };
