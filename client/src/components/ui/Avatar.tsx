import { avatarClass, initials } from "../../lib/format";

export default function Avatar({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-5 shrink-0 items-center justify-center border-2 border-fg font-mono text-[9px] font-bold leading-none text-fg ${avatarClass(name)} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
