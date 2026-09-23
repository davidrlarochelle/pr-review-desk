import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Drop the offset shadow when the block does not sit directly on the page. */
  flat?: boolean;
}

export default function Card({ flat = false, className = "", ...rest }: CardProps) {
  return <div className={`border-2 border-fg bg-surface ${flat ? "" : "shadow-hard"} ${className}`} {...rest} />;
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center gap-3 border-b-2 border-fg px-4 h-12 ${className}`}>{children}</div>;
}

type Tone = "neutral" | "info" | "problem" | "summary";

// Label band: the filled strip that carries a block's section title. Blue is the only fill that takes white text.
const TONES: Record<Tone, string> = {
  neutral: "bg-subtle text-fg",
  info: "bg-primary text-white",
  problem: "bg-danger text-fg",
  summary: "bg-success text-fg",
};

export function Eyebrow({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={`inline-flex h-6 items-center px-2 label-caps ${TONES[tone]} ${className}`}>{children}</span>;
}

/** Full-width label band across the top of a section inside a block. */
export function Band({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <div className={`flex h-7 shrink-0 items-center gap-2 border-b-2 border-fg px-5 label-caps ${TONES[tone]} ${className}`}>{children}</div>;
}

export function Chip({ children, mono = false, className = "" }: { children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex h-[22px] items-center border-2 border-fg bg-surface px-1.5 leading-none text-fg ${
        mono ? "font-mono text-[11px] font-medium" : "label-caps"
      } ${className}`}
    >
      {children}
    </span>
  );
}
