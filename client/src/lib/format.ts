export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

export function initials(name: string): string {
  const clean = name.replace(/[^a-z0-9]/gi, " ").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

// Flat accent fills (sky / amber / green / subtle), ink initials — no gradients.
const AVATAR_PALETTES = ["bg-sev-low-bg", "bg-sev-high-bg", "bg-success", "bg-subtle"];

export function avatarClass(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length];
}
