import { ReactNode } from "react";

export function Screen({ children }: { children: ReactNode }) {
  return <main className="flex flex-1 flex-col px-6 py-8">{children}</main>;
}

export function ScreenHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
      {subtitle ? (
        <p className="mt-2 text-sm text-neutral-600">{subtitle}</p>
      ) : null}
    </header>
  );
}

export function ScreenBody({ children }: { children: ReactNode }) {
  return <div className="flex-1">{children}</div>;
}

export function ScreenFooter({ children }: { children: ReactNode }) {
  return <div className="mt-8 flex flex-col gap-2">{children}</div>;
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        "h-12 w-full rounded-xl bg-neutral-900 text-base font-medium text-white shadow-sm transition active:scale-[.98] disabled:bg-neutral-300 " +
        (props.className ?? "")
      }
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        "h-12 w-full rounded-xl border border-neutral-300 bg-white text-base font-medium text-neutral-900 transition active:scale-[.98] " +
        (props.className ?? "")
      }
    >
      {children}
    </button>
  );
}
