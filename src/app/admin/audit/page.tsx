import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, clearAdminCookie } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/shell";

const PAGE_SIZE = 100;

const TRIGGER_LABEL: Record<string, { label: string; color: string }> = {
  user: { label: "юзер", color: "var(--admin-info)" },
  admin: { label: "admin", color: "var(--admin-accent-deep)" },
  system: { label: "system", color: "var(--admin-text-muted)" },
};

const FIELD_LABEL: Record<string, string> = {
  lifecycle_state: "lifecycle",
  onboarding_step: "onboarding",
  verification_status: "verification",
  profile_completion: "profile",
  quiz_completion: "quiz",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

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

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    user?: string;
    trigger?: string;
    page?: string;
    range?: string;
  }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const sp = await searchParams;
  const userFilter = sp.user ?? "";
  const triggerFilter = sp.trigger ?? "all";
  const range = sp.range ?? "all"; // all | 24h | 7d | 30d
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let q = supabaseAdmin
    .from("user_state_transitions")
    .select("id, user_id, field, old_value, new_value, reason, triggered_by, created_at", {
      count: "exact",
    });

  if (userFilter) q = q.eq("user_id", userFilter);
  if (triggerFilter !== "all") q = q.eq("triggered_by", triggerFilter);

  if (range !== "all") {
    const hours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30;
    // eslint-disable-next-line react-hooks/purity -- server component, request-time clock
    const sinceMs = Date.now() - hours * 60 * 60 * 1000;
    q = q.gte("created_at", new Date(sinceMs).toISOString());
  }

  const { data: rows, count } = await q
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const items = rows ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Lookup user names for displayed rows
  const userIds = Array.from(new Set(items.map((r) => r.user_id)));
  const { data: usersMeta } =
    userIds.length > 0
      ? await supabaseAdmin
          .from("users")
          .select("id, telegram_first_name, telegram_username")
          .in("id", userIds)
      : { data: [] };
  const userMap = new Map(
    (usersMeta ?? []).map((u) => [
      u.id,
      u.telegram_first_name ?? u.telegram_username ?? "Без имени",
    ]),
  );

  async function logout() {
    "use server";
    await clearAdminCookie();
    redirect("/admin/login");
  }

  function buildHref(opts: {
    trigger?: string;
    user?: string;
    range?: string;
    page?: number;
  }) {
    const p = new URLSearchParams();
    const newTrigger = opts.trigger ?? triggerFilter;
    if (newTrigger !== "all") p.set("trigger", newTrigger);
    const newUser = opts.user ?? userFilter;
    if (newUser) p.set("user", newUser);
    const newRange = opts.range ?? range;
    if (newRange !== "all") p.set("range", newRange);
    if (opts.page && opts.page > 1) p.set("page", String(opts.page));
    const qs = p.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  }

  return (
    <AdminShell
      title="Журнал изменений"
      subtitle="Аудит всех переходов между состояниями пользователей. Кто, что, когда и почему."
      onLogout={logout}
      activeNav="/admin/audit"
    >
      <section className="overflow-hidden rounded-xl border border-[--admin-border] bg-white shadow-[var(--admin-shadow-sm)]">
        <div className="flex flex-col gap-3 border-b border-[--admin-border] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="trigger"
              className="inline-flex items-center gap-1 rounded-lg p-1"
              style={{ backgroundColor: "var(--admin-surface-2)" }}
            >
              {[
                { key: "all", label: "Все" },
                { key: "user", label: "Юзер" },
                { key: "admin", label: "Админ" },
                { key: "system", label: "Система" },
              ].map((t) => {
                const active = triggerFilter === t.key;
                return (
                  <Link
                    key={t.key}
                    href={buildHref({ trigger: t.key, page: 1 })}
                    role="tab"
                    aria-selected={active}
                    className={
                      "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition " +
                      (active
                        ? "bg-white text-[--admin-text] shadow-[var(--admin-shadow-sm)]"
                        : "text-[--admin-text-2] hover:text-[--admin-text]")
                    }
                  >
                    {t.label}
                  </Link>
                );
              })}
            </div>

            <div
              role="tablist"
              aria-label="period"
              className="inline-flex items-center gap-1 rounded-lg p-1"
              style={{ backgroundColor: "var(--admin-surface-2)" }}
            >
              {[
                { key: "all", label: "Всё время" },
                { key: "24h", label: "24ч" },
                { key: "7d", label: "7д" },
                { key: "30d", label: "30д" },
              ].map((r) => {
                const active = range === r.key;
                return (
                  <Link
                    key={r.key}
                    href={buildHref({ range: r.key, page: 1 })}
                    role="tab"
                    aria-selected={active}
                    className={
                      "inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium transition " +
                      (active
                        ? "bg-white text-[--admin-text] shadow-[var(--admin-shadow-sm)]"
                        : "text-[--admin-text-2] hover:text-[--admin-text]")
                    }
                  >
                    {r.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {userFilter ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[--admin-text-muted]">Юзер:</span>
              <span className="font-mono text-[--admin-text]">
                {userMap.get(userFilter) ?? userFilter.slice(0, 8)}
              </span>
              <Link
                href={buildHref({ user: "", page: 1 })}
                className="text-[--admin-text-muted] hover:text-[--admin-text]"
              >
                ×
              </Link>
            </div>
          ) : (
            <p className="text-xs text-[--admin-text-muted]">
              Всего записей: <span className="font-semibold text-[--admin-text]">{totalCount}</span>
            </p>
          )}
        </div>

        {items.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm text-[--admin-text-2]">Пока пусто</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--admin-border] bg-[--admin-surface-2] text-left text-[11px] font-semibold uppercase tracking-wider text-[--admin-text-muted]">
                    <th className="px-5 py-2.5">Время</th>
                    <th className="px-5 py-2.5">Юзер</th>
                    <th className="px-5 py-2.5">Поле</th>
                    <th className="px-5 py-2.5">Изменение</th>
                    <th className="hidden px-5 py-2.5 lg:table-cell">Причина</th>
                    <th className="px-5 py-2.5">Кто</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const trigger =
                      TRIGGER_LABEL[row.triggered_by ?? "system"] ?? TRIGGER_LABEL.system;
                    const userName = userMap.get(row.user_id) ?? row.user_id.slice(0, 8);
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[--admin-border] last:border-b-0"
                      >
                        <td className="px-5 py-2.5 text-xs">
                          <p className="text-[--admin-text]">{timeAgo(row.created_at)}</p>
                          <p className="font-mono text-[10px] text-[--admin-text-muted]">
                            {formatDateTime(row.created_at)}
                          </p>
                        </td>
                        <td className="px-5 py-2.5">
                          <Link
                            href={`/admin/moderation/${row.user_id}`}
                            className="text-sm font-medium text-[--admin-info] hover:underline"
                          >
                            {userName}
                          </Link>
                          <Link
                            href={buildHref({ user: row.user_id, page: 1 })}
                            className="ml-2 text-[10px] text-[--admin-text-muted] hover:text-[--admin-text]"
                            title="Показать только этого юзера"
                          >
                            (filter)
                          </Link>
                        </td>
                        <td className="px-5 py-2.5">
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[11px] font-mono font-medium"
                            style={{
                              backgroundColor: "var(--admin-surface-2)",
                              color: "var(--admin-text-2)",
                            }}
                          >
                            {FIELD_LABEL[row.field] ?? row.field}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-xs">
                          <span className="font-mono text-[--admin-text-muted]">
                            {row.old_value || "∅"}
                          </span>
                          <span className="mx-1.5 text-[--admin-text-muted]">→</span>
                          <span className="font-mono font-semibold text-[--admin-text]">
                            {row.new_value || "∅"}
                          </span>
                        </td>
                        <td className="hidden max-w-md truncate px-5 py-2.5 text-xs text-[--admin-text-2] lg:table-cell">
                          {row.reason ?? "—"}
                        </td>
                        <td className="px-5 py-2.5">
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                            style={{
                              backgroundColor: "var(--admin-surface-2)",
                              color: trigger.color,
                            }}
                          >
                            {trigger.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-[--admin-border] bg-[--admin-surface-2] px-4 py-3 text-xs text-[--admin-text-2]">
                <p>
                  {offset + 1}–{Math.min(offset + items.length, totalCount)} из{" "}
                  <span className="font-semibold text-[--admin-text]">{totalCount}</span>
                </p>
                <div className="flex items-center gap-1.5">
                  {page > 1 ? (
                    <Link
                      href={buildHref({ page: page - 1 })}
                      className="inline-flex h-7 items-center rounded-md border border-[--admin-border] bg-white px-2.5 font-medium text-[--admin-text-2] hover:text-[--admin-text]"
                    >
                      ← Назад
                    </Link>
                  ) : null}
                  <span className="px-1">
                    стр. {page} из {totalPages}
                  </span>
                  {page < totalPages ? (
                    <Link
                      href={buildHref({ page: page + 1 })}
                      className="inline-flex h-7 items-center rounded-md border border-[--admin-border] bg-white px-2.5 font-medium text-[--admin-text-2] hover:text-[--admin-text]"
                    >
                      Дальше →
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </AdminShell>
  );
}
