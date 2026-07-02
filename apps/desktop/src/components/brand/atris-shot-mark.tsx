import { cn } from "@/lib/utils";

type MarkProps = {
  className?: string;
  title?: string;
};

export function AtrisShotMark({ className, title = "AtrisShot" }: MarkProps) {
  return (
    <span className={cn("block shrink-0", className)}>
      <img className="h-full w-full dark:hidden" src="/brand/atris-shot-mark-light.svg" alt={title} />
      <img className="hidden h-full w-full dark:block" src="/brand/atris-shot-mark-dark.svg" alt={title} />
    </span>
  );
}

export function AtrisShotPulse({
  active,
  className,
}: MarkProps & { active: boolean }) {
  return (
    <span
      className={cn("atris-shot-pulse relative grid place-items-center", className)}
      data-active={active}
      aria-hidden="true"
    >
      <span className="atris-shot-pulse-ring absolute inset-0 rounded-full border border-primary/35" />
      <span className="atris-shot-pulse-ring absolute inset-1 rounded-full border border-primary/45 [animation-delay:600ms]" />
      <span className="relative block h-9 w-9 rounded-xl shadow-sm">
        <img className="h-full w-full rounded-xl dark:hidden" src="/brand/atris-shot-mark-light.svg" alt="" />
        <img className="hidden h-full w-full rounded-xl dark:block" src="/brand/atris-shot-mark-dark.svg" alt="" />
      </span>
    </span>
  );
}
