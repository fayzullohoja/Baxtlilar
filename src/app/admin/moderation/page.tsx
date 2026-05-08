import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, clearAdminCookie } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminShell, StatTile, StatusBadge } from "@/components/admin/shell";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  const d = Math.floor(h / 24);
  return `${d} д`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ModerationListPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const { data: pending } = await supabaseAdmin
    .from("users")
    .select(
      "id, telegram_id, telegram_username, telegram_first_name, phone_number, language, verification_status, onboarding_step, created_at",
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
  const total = stats?.length ?? 0;

  return (
    <AdminShell
      title="Модерация"
      subtitle="Проверьте паспорт и selfie. Одобряйте, если данные читаются и совпадают."
      onLogout={logout}
    >
      {/* Stats grid */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="В очереди" value={items.length} tone="warn" />
        <StatTile label="Одобрено" value={counts.approved ?? 0} tone="success" />
        <StatTile label="Отклонено" value={counts.rejected ?? 0} tone="danger" />
        <StatTile label="Всего юзеров" value={total} />
      </section>

      {/* Queue table */}
      <section className="overflow-hidden rounded-xl border border-[--admin-border] bg-white shadow-[var(--admin-shadow-sm)]">
        <div className="flex items-center justify-between border-b border-[--admin-border] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[--admin-text]">
              Очередь модерации
            </h2>
            <span
              className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: "var(--admin-warn-bg)",
                color: "var(--admin-warn)",
              }}
            >
              {items.length}
            </span>
          </div>
          <span className="text-xs text-[--admin-text-muted]">
            FIFO · сначала самые старые
          </span>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                backgroundColor: "var(--admin-success-bg)",
                color: "var(--admin-success)",
              }}
              aria-hidden
            >
              <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none">
                <path
                  d="M5 10.5l3.5 3.5L15 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-[--admin-text]">
              Очередь пуста
            </h3>
            <p className="mt-1 text-sm text-[--admin-text-2]">
              Все заявки обработаны. Можно отдыхать.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[--admin-border] bg-[--admin-surface-2] text-left text-[11px] font-semibold uppercase tracking-wider text-[--admin-text-muted]">
                  <th className="px-5 py-2.5 font-semibold">Пользователь</th>
                  <th className="hidden px-5 py-2.5 font-semibold sm:table-cell">
                    Контакт
                  </th>
                  <th className="hidden px-5 py-2.5 font-semibold md:table-cell">
                    Telegram
                  </th>
                  <th className="hidden px-5 py-2.5 font-semibold md:table-cell">
                    Язык
                  </th>
                  <th className="px-5 py-2.5 font-semibold">Статус</th>
                  <th className="px-5 py-2.5 text-right font-semibold">
                    Подано
                  </th>
                  <th className="w-12 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => {
                  const initial = (u.telegram_first_name ?? "?")
                    .trim()
                    .slice(0, 1)
                    .toUpperCase();
                  return (
                    <tr
                      key={u.id}
                      className="group border-b border-[--admin-border] last:border-b-0 transition hover:bg-[--admin-row-hover]"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/moderation/${u.id}`}
                          className="flex items-center gap-3"
                        >
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: "var(--admin-surface-2)",
                              color: "var(--admin-text-2)",
                              border: "1px solid var(--admin-border)",
                            }}
                          >
                            {initial}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[--admin-text]">
                              {u.telegram_first_name ?? "Без имени"}
                            </p>
                            <p className="truncate text-xs text-[--admin-text-muted] sm:hidden">
                              {u.phone_number ?? "—"}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="hidden px-5 py-3 font-mono text-xs text-[--admin-text-2] sm:table-cell">
                        {u.phone_number ?? "—"}
                      </td>
                      <td className="hidden px-5 py-3 text-xs md:table-cell">
                        {u.telegram_username ? (
                          <span className="text-[--admin-info]">
                            @{u.telegram_username}
                          </span>
                        ) : (
                          <span className="text-[--admin-text-muted]">—</span>
                        )}
                        <span className="ml-1.5 font-mono text-[--admin-text-muted]">
                          {String(u.telegram_id)}
                        </span>
                      </td>
                      <td className="hidden px-5 py-3 text-xs uppercase text-[--admin-text-2] md:table-cell">
                        {u.language ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge label="На проверку" tone="warn" />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <p className="text-sm text-[--admin-text]">
                          {timeAgo(u.created_at)}
                        </p>
                        <p className="hidden text-[11px] text-[--admin-text-muted] sm:block">
                          {formatDateTime(u.created_at)}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/admin/moderation/${u.id}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[--admin-text-muted] transition group-hover:bg-white group-hover:text-[--admin-text] group-hover:shadow-[var(--admin-shadow-sm)]"
                          aria-label="Открыть"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                            <path
                              d="M6 4l4 4-4 4"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
