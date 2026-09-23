export default function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block ${className}`} />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  const widths = ["w-9", "w-80", "w-20", "w-24", "w-16", "w-28"];
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-13 items-center gap-4 edge-soft-b px-4 last:border-b-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-3 ${widths[c % widths.length]}`} />
          ))}
          <Skeleton className="ml-auto h-[26px] w-[76px]" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-2.5 edge bg-surface p-4 lift">
      <Skeleton className="h-2.5 w-16" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-[11px] ${i === lines - 1 ? "w-3/5" : "w-full"}`} />
      ))}
    </div>
  );
}
