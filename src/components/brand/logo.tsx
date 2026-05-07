/**
 * Bakhtlilar mark — three rounded figures (parents + child) connected
 * by a wave at the bottom. Inherits color from `currentColor`.
 */
export function Logo({
  size = 56,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Bakhtlilar"
      className={className}
    >
      <g
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M 20 30 L 20 54" />
        <path d="M 40 40 L 40 60" />
        <path d="M 60 20 L 60 54" />
        <path d="M 20 54 Q 30 64 40 60 Q 50 64 60 54" />
      </g>
      <circle cx="20" cy="22" r="5" fill="currentColor" />
      <circle cx="40" cy="33" r="4" fill="currentColor" />
      <circle cx="60" cy="13" r="5.5" fill="currentColor" />
    </svg>
  );
}

export function LogoLockup({
  size = 32,
  showWord = true,
  className,
}: {
  size?: number;
  showWord?: boolean;
  className?: string;
}) {
  return (
    <span className={"inline-flex items-center gap-2.5 " + (className ?? "")}>
      <span style={{ color: "var(--color-brand)" }}>
        <Logo size={size} />
      </span>
      {showWord ? (
        <span
          className="text-lg font-semibold tracking-tight"
          style={{ color: "var(--color-plum)" }}
        >
          Bakhtlilar
        </span>
      ) : null}
    </span>
  );
}
