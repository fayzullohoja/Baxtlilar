import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, clearAdminCookie } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LogoLockup } from "@/components/brand/logo";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} д назад`;
}

export default async function ModerationListPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const { data: pending } = await supabaseAdmin
    .from("users")
    .select(
      "id, telegram_id, telegram_username, telegram_first_name, phone_number, verification_status, onboarding_step, created_at",
    )
    .eq("verification_status", "pending_review")
    .order("created_at", { ascending: true });

  const { data: stats } = await supabaseAdmin
    .from("users")
    .select("verification_status");

  const counts = (stats ?? []).reduce<Record<string, number>>((acc, u) => {
    acc[u.verification_status] = (acc[u.verification_status] ?? 0) + 1;
    return acc;
  }, {});

  async function logout() {
    "use server";
    await clearAdminCookie();
    redirect("/admin/login");
  }

  const items = pending ?? [];

  return (
    <div className="min-h-dvh bg-[--color-cream]">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
        {/* Top bar */}
        <header className="mb-8 flex items-center justify-between">
          <LogoLockup size={28} />
          <form action={logout}>
            <button
              type="submit"
              className="rounded-full px-4 py-2 text-xs font-semibold text-[--color-plum-soft] hover:bg-white"
            >
              Выйти
            </button>
          </form>
        </header>

        {/* Title block */}
        <div className="mb-7">
          <h1 className="text-3xl font-semibold tracking-tight text-[--color-plum]">
            Очередь модерации
          </h1>
          <p className="mt-2 text-sm text-[--color-ink-2]">
            Проверяйте паспорт и selfie. Одобряйте, если данные читаются и совпадают.
          </p>
        </div>

        {/* Stats strip */}
        <section className="mb-6 grid grid-cols-3 gap-3">
          <StatCard
            label="В очереди"
            value={items.length}
            tone="brand"
          />
          <StatCard
            label="Одобрено"
            value={counts.approved ?? 0}
            tone="success"
          />
          <StatCard
            label="Отклонено"
            value={counts.rejected ?? 0}
            tone="muted"
          />
        </section>

        {/* List */}
        {items.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 text-center shadow-[0_4px_16px_rgba(74,44,53,0.06)]">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
              style={{ backgroundColor: "var(--color-blush)" }}
            >
              🌿
            </div>
            <h2 className="text-lg font-semibold text-[--color-plum]">
              Очередь пуста
            </h2>
            <p className="mt-2 text-sm text-[--color-ink-2]">
              Все заявки обработаны. Можно отдыхать.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((u) => {
              const initial =
                (u.telegram_first_name ?? "?").trim().slice(0, 1).toUpperCase();
              return (
                <li key={u.id}>
                  <Link
                    href={`/admin/moderation/${u.id}`}
                    className="group block rounded-3xl bg-white p-5 shadow-[0_4px_16px_rgba(74,44,53,0.06)] transition hover:shadow-[0_8px_24px_-8px_rgba(74,44,53,0.12)]"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold"
                        style={{
                          backgroundColor: "var(--color-blush)",
                          color: "var(--color-brand-deep)",
                        }}
                      >
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[--color-plum]">
                          {u.telegram_first_name ?? "Без имени"}
                          {u.telegram_username ? (
                            <span className="ml-1.5 font-normal text-[--color-ink-muted]">
                              @{u.telegram_username}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 truncate text-xs text-[--color-ink-2]">
                          {u.phone_number ?? "—"} · TG {u.telegram_id}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            backgroundColor: "var(--color-blush)",
                            color: "var(--color-brand-deep)",
                          }}
                        >
                          На проверку
                        </span>
                        <span className="text-xs text-[--color-ink-muted]">
                          {timeAgo(u.created_at)}
                        </span>
                      </div>
                      <svg
                        className="h-5 w-5 shrink-0 text-[--color-ink-muted] transition group-hover:translate-x-0.5 group-hover:text-[--color-brand]"
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M7 5l5 5-5 5"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "brand" | "success" | "muted";
}) {
  const styles = {
    brand: {
      bg: "var(--color-blush)",
      text: "var(--color-brand-deep)",
      label: "var(--color-plum-soft)",
    },
    success: {
      bg: "var(--color-success-bg)",
      text: "var(--color-success)",
      label: "var(--color-plum-soft)",
    },
    muted: {
      bg: "white",
      text: "var(--color-plum-mute)",
      label: "var(--color-ink-muted)",
    },
  }[tone];
  return (
    <div
      className="rounded-2xl p-4 shadow-[0_4px_16px_rgba(74,44,53,0.04)]"
      style={{ backgroundColor: styles.bg }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: styles.label }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-3xl font-semibold tracking-tight"
        style={{ color: styles.text }}
      >
        {value}
      </p>
    </div>
  );
}
