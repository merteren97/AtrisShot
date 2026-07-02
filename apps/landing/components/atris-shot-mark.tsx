export function AtrisShotMark({ className = "" }: { className?: string }) {
  return (
    <span className={`block ${className}`}>
      <img className="h-full w-full dark:hidden" src="/brand/atris-shot-mark-light.svg" alt="AtrisShot" />
      <img className="hidden h-full w-full dark:block" src="/brand/atris-shot-mark-dark.svg" alt="AtrisShot" />
    </span>
  );
}
