import Link from "next/link";
import { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

const NAV_ITEMS = [
  { href: "/admin/moderation", label: "Очередь", match: "/admin/moderation" },
  { href: "/admin/users", label: "Все юзеры", match: "/admin/users" },
  { href: "/admin/banned", label: "Забанены", match: "/admin/banned" },
  { href: "/admin/audit", label: "Журнал", match: "/admin/audit" },
  { href: "/admin/stats", label: "Аналитика", match: "/admin/stats" },
];

export function AdminShell({
  children,
  title,
  subtitle,
  breadcrumb,
  actions,
  onLogout,
  activeNav,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  breadcrumb?: { label: string; href: string }[];
  actions?: ReactNode;
  onLogout: () => Promise<void> | void;
  /** Override which nav item shows as active (auto-detected from breadcrumb otherwise) */
  activeNav?: string;
}) {
  // Auto-detect active nav from breadcrumb; falls back to first nav item
  const detectedActive =
    activeNav ??
    breadcrumb?.find((b) => NAV_ITEMS.some((n) => b.href.startsWith(n.match)))?.href ??
    NAV_ITEMS[0].href;

  return (
    <div className="admin-scope min-h-dvh bg-[--admin-bg] text-[--admin-text]">
      {/* Sticky topbar */}
      <header className="sticky top-0 z-20 border-b border-[--admin-border] bg-[--admin-surface]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-6">
            <Link
              href="/admin/moderation"
              className="flex items-center gap-2.5 text-[--admin-text]"
            >
              <span style={{ color: "var(--admin-accent)" }}>
                <Logo size={22} />
              </span>
              <span className="text-[15px] font-semibold tracking-tight">
                Bakhtlilar
              </span>
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: "var(--admin-accent)",
                  color: "white",
                }}
              >
                Admin
              </span>
            </Link>

            <nav className="hidden items-center gap-1 sm:flex">
              {NAV_ITEMS.map((item) => {
                const active = detectedActive.startsWith(item.match);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      "inline-flex h-8 items-center rounded-md px-3 text-xs font-medium transition " +
                      (active
                        ? "bg-[--admin-surface-2] text-[--admin-text]"
                        : "text-[--admin-text-2] hover:bg-[--admin-row-hover] hover:text-[--admin-text]")
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <form action={onLogout}>
            <button
              type="submit"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[--admin-border] bg-white px-3 text-xs font-medium text-[--admin-text-2] transition hover:border-[--admin-border-strong] hover:text-[--admin-text]"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                <path
                  d="M11 4l3 4-3 4M14 8H6M9 13H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Выйти
            </button>
          </form>
        </div>

        {/* Mobile nav row */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-[--admin-border] px-4 py-2 sm:hidden">
          {NAV_ITEMS.map((item) => {
            const active = detectedActive.startsWith(item.match);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "inline-flex h-7 shrink-0 items-center rounded-md px-2.5 text-xs font-medium " +
                  (active
                    ? "bg-[--admin-surface-2] text-[--admin-text]"
                    : "text-[--admin-text-2]")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Page header */}
      <div className="border-b border-[--admin-border] bg-[--admin-surface]">
        <div className="mx-auto max-w-6xl px-5 py-6">
          {breadcrumb && breadcrumb.length > 0 ? (
            <nav className="mb-2 flex items-center gap-1.5 text-xs text-[--admin-text-muted]">
              {breadcrumb.map((b, i) => (
                <span key={b.href} className="flex items-center gap-1.5">
                  {i > 0 ? (
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M6 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                  <Link href={b.href} className="hover:text-[--admin-text-2]">
                    {b.label}
                  </Link>
                </span>
              ))}
            </nav>
          ) : null}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[--admin-text]">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-[--admin-text-2]">{subtitle}</p>
              ) : null}
            </div>
            {actions ? <div className="flex gap-2">{actions}</div> : null}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: number | string;
  tone?: "default" | "warn" | "success" | "danger";
  hint?: string;
}) {
  const dot = {
    default: "var(--admin-text-muted)",
    warn: "var(--admin-warn)",
    success: "var(--admin-success)",
    danger: "var(--admin-danger)",
  }[tone];
  return (
    <div
      className="rounded-lg border border-[--admin-border] bg-white p-4 shadow-[var(--admin-shadow-sm)]"
    >
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: dot }}
          aria-hidden
        />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[--admin-text-muted]">
          {label}
        </p>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-[--admin-text]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[--admin-text-muted]">{hint}</p>
      ) : null}
    </div>
  );
}

export function StatusBadge({
  label,
  tone,
  withDot = true,
}: {
  label: string;
  tone: "default" | "warn" | "success" | "danger" | "info";
  withDot?: boolean;
}) {
  const styles = {
    default: {
      bg: "var(--admin-surface-2)",
      text: "var(--admin-text-2)",
      border: "var(--admin-border)",
    },
    warn: {
      bg: "var(--admin-warn-bg)",
      text: "var(--admin-warn)",
      border: "var(--admin-warn-border)",
    },
    success: {
      bg: "var(--admin-success-bg)",
      text: "var(--admin-success)",
      border: "var(--admin-success-border)",
    },
    danger: {
      bg: "var(--admin-danger-bg)",
      text: "var(--admin-danger)",
      border: "var(--admin-danger-border)",
    },
    info: {
      bg: "var(--admin-info-bg)",
      text: "var(--admin-info)",
      border: "var(--admin-info-bg)",
    },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: styles.bg,
        color: styles.text,
        borderColor: styles.border,
      }}
    >
      {withDot ? (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: styles.text }}
          aria-hidden
        />
      ) : null}
      {label}
    </span>
  );
}
