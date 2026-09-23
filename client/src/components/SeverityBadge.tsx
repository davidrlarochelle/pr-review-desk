const LABELS: Record<string, string> = { blocker: "Blocker", high: "High", medium: "Medium", low: "Low", nit: "Nit" };

const STYLES: Record<string, string> = {
  blocker: "bg-sev-blocker-bg text-sev-blocker",
  high: "bg-sev-high-bg text-sev-high",
  medium: "bg-sev-medium-bg text-sev-medium",
  low: "bg-sev-low-bg text-sev-low",
  nit: "bg-sev-nit-bg text-sev-nit",
};

export default function SeverityBadge({
  severity,
  count,
  className = "",
}: {
  severity: string;
  count?: number;
  className?: string;
}) {
  const s = STYLES[severity] ?? STYLES.nit;
  return (
    <span
      className={`inline-flex h-[26px] items-center whitespace-nowrap border-2 border-fg px-2 label-caps text-[11px] tracking-[.07em] leading-none ${
        count !== undefined ? "font-mono" : ""
      } ${s} ${className}`}
    >
      {count !== undefined ? count : LABELS[severity] ?? severity}
    </span>
  );
}
