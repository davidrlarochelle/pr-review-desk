import type { MyReviewState } from "../../../shared/types";

const LABELS: Record<string, string> = { none: "No review", queued: "Queued", running: "Running", reported: "Reported", failed: "Failed" };

// No dot, no ping — the fill is the signal.
const STYLES: Record<string, string> = {
  none: "bg-st-none-bg text-st-none",
  queued: "bg-st-queued-bg text-st-queued",
  running: "bg-st-running-bg text-st-running",
  reported: "bg-st-reported-bg text-st-reported",
  failed: "bg-st-failed-bg text-st-failed",
};

const BLOCK = "inline-flex items-center whitespace-nowrap border-2 border-fg px-2 label-caps text-[11px] tracking-[.07em] leading-none";

export default function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = STYLES[status] ?? STYLES.none;
  return <span className={`${BLOCK} h-[26px] ${s}`}>{label ?? LABELS[status] ?? status}</span>;
}

export function FindingStateBadge({ state }: { state: string }) {
  const cls =
    state === "posted"
      ? "bg-success text-fg"
      : state === "dismissed"
      ? "bg-subtle text-fg-3 line-through"
      : "bg-surface text-fg";
  return <span className={`${BLOCK} h-[22px] ${cls}`}>{state}</span>;
}

const MY_REVIEW: Record<MyReviewState, { label: string; cls: string }> = {
  APPROVED: { label: "Approved", cls: "bg-success text-fg" },
  CHANGES_REQUESTED: { label: "Changes", cls: "bg-danger text-fg" },
  COMMENTED: { label: "Commented", cls: "bg-surface text-fg" },
};

/** The viewer's own GitHub review on a PR, as opposed to StatusBadge (our AI review). */
export function MyReviewBadge({ state, isAuthor }: { state: MyReviewState | null; isAuthor: boolean }) {
  if (isAuthor) return <span className="label-caps text-fg-3">Author</span>;
  if (!state) return <span className="text-fg-3">—</span>;
  const s = MY_REVIEW[state];
  return <span className={`${BLOCK} h-[26px] ${s.cls}`}>{s.label}</span>;
}
