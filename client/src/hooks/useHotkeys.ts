import { useEffect, useRef } from "react";

type Handler = (e: KeyboardEvent) => void;

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/**
 * Single-key shortcuts for the current screen. Keys are lowercase letters or "Escape".
 * Ignored while typing in a field, with a modifier held, or when something else already handled the key.
 */
export function useHotkeys(map: Record<string, Handler | false | undefined>) {
  const ref = useRef(map);
  ref.current = map;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) return;
      const key = e.key === "Escape" ? "Escape" : e.key.toLowerCase();
      const handler = ref.current[key];
      if (!handler) return;
      e.preventDefault();
      handler(e);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/** Moves focus to the next/previous element matching `selector` (J/K row movement). */
export function moveFocus(selector: string, delta: 1 | -1) {
  const items = Array.from(document.querySelectorAll<HTMLElement>(selector));
  if (items.length === 0) return;
  const active = document.activeElement;
  const i = items.findIndex((el) => el === active || el.contains(active));
  const next = i < 0 ? (delta > 0 ? 0 : items.length - 1) : Math.min(items.length - 1, Math.max(0, i + delta));
  items[next].focus();
}

/** The value of `attr` on the closest ancestor of the focused element that carries it. */
export function focusedAttr(attr: string): string | null {
  const el = document.activeElement?.closest(`[${attr}]`);
  return el?.getAttribute(attr) ?? null;
}
