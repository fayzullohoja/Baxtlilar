import { ReactNode } from "react";

export function Screen({ children }: { children: ReactNode }) {
  return <main className="flex flex-1 flex-col px-5 py-7">{children}</main>;
}

export function ScreenHeader({
  title,
  subtitle,
  step,
}: {
  title: string;
  subtitle?: string;
  step?: { current: number; total: number };
}) {
  return (
    <header className="mb-6">
      {step ? (
        <p className="mb-3 text-xs font-medium tracking-wide text-[--color-ink-muted] uppercase">
          Шаг {step.current} из {step.total}
        </p>
      ) : null}
      <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[--color-plum]">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-[15px] leading-relaxed text-[--color-ink-2]">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

export function ScreenBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`flex-1 ${className}`}>{children}</div>;
}

export function ScreenFooter({ children }: { children: ReactNode }) {
  return <div className="mt-8 flex flex-col gap-3">{children}</div>;
}

const baseBtn =
  "inline-flex w-full items-center justify-center gap-2 h-13 px-6 rounded-2xl text-[15px] font-semibold transition-all duration-150 active:scale-[.98] disabled:cursor-not-allowed select-none";

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${baseBtn} text-white shadow-[0_8px_20px_-8px_rgba(255,111,145,0.55)] disabled:bg-[--color-ink-muted] disabled:shadow-none ${className}`}
      style={{
        backgroundColor: "var(--color-brand)",
        ...(props.style ?? {}),
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${baseBtn} bg-[--color-blush] text-[--color-brand-deep] hover:bg-[--color-blush-soft] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${baseBtn} border border-[--color-line] bg-white text-[--color-plum] hover:border-[--color-brand-border] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className={`rounded-3xl bg-white shadow-[0_4px_16px_rgba(74,44,53,0.06)] ${className}`}
    >
      {children}
    </Tag>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warn" | "danger";
  className?: string;
}) {
  const toneClass = {
    neutral: "bg-[--color-line-soft] text-[--color-plum-soft]",
    brand: "bg-[--color-blush] text-[--color-brand-deep]",
    success: "bg-[--color-success-bg] text-[--color-success]",
    warn: "bg-[--color-warn-bg] text-[--color-warn]",
    danger: "bg-[--color-danger-bg] text-[--color-danger]",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
}

const fieldBase =
  "h-12 rounded-2xl border border-[--color-line] bg-[--color-blush-soft] px-4 text-base text-[--color-plum] placeholder:text-[--color-ink-muted] transition";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  // Plain <div>, not <label> — children may render their own <label>s
  // (RadioList, CheckboxList), and nested labels break radio/checkbox clicks.
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted]">
        {label}
      </p>
      {children}
      {hint ? (
        <p className="text-xs text-[--color-ink-muted]">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldBase} ${className}`} />;
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${fieldBase} h-auto min-h-[120px] py-3 leading-relaxed resize-none ${className}`}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${fieldBase} appearance-none ${className}`}>
      {children}
    </select>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-[--color-danger-bg] px-4 py-3 text-center text-sm text-[--color-danger]">
      {children}
    </p>
  );
}

export function InfoBanner({
  tone = "warn",
  children,
}: {
  tone?: "warn" | "brand";
  children: ReactNode;
}) {
  const cls =
    tone === "warn"
      ? "border-[--color-warn] bg-[--color-warn-bg] text-[--color-warn]"
      : "border-[--color-brand-border] bg-[--color-blush] text-[--color-brand-deep]";
  return (
    <p
      className={`rounded-2xl border px-4 py-3 text-center text-xs leading-relaxed ${cls}`}
    >
      {children}
    </p>
  );
}
