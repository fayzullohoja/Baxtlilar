import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, clearAdminCookie } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminShell, StatTile } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

export default async function AdminLandingPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const [
    { count: pendingCount },
    { count: signupsToday },
    { count: totalUsers },
    { count: blockedCount },
    { data: approvalsToday },
  ] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "pending_review"),
    supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayIso),
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("lifecycle_state", "blocked"),
    supabaseAdmin
      .from("user_state_transitions")
      .select("id, new_value")
      .eq("triggered_by", "admin")
      .eq("field", "verification_status")
      .gte("created_at", todayIso),
  ]);

  const approvedToday = (approvalsToday ?? []).filter(
    (a) => a.new_value === "approved",
  ).length;
  const rejectedToday = (approvalsToday ?? []).filter(
    (a) => a.new_value === "rejected",
  ).length;

  async function logout() {
    "use server";
    await clearAdminCookie();
    redirect("/admin/login");
  }

  return (
    <AdminShell
      title="Дашборд"
      subtitle="Сводка за сегодня. Кликните по плитке, чтобы перейти к разделу."
      onLogout={logout}
      activeNav="/admin"
    >
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/admin/moderation">
          <StatTile
            label="В очереди"
            value={pendingCount ?? 0}
            tone="warn"
            hint="требуют решения"
          />
        </Link>
        <Link href="/admin/audit?trigger=admin&range=24h">
          <StatTile
            label="Одобрено сегодня"
            value={approvedToday}
            tone="success"
          />
        </Link>
        <Link href="/admin/audit?trigger=admin&range=24h">
          <StatTile
            label="Отклонено сегодня"
            value={rejectedToday}
            tone="danger"
          />
        </Link>
        <Link href="/admin/users">
          <StatTile
            label="Регистраций сегодня"
            value={signupsToday ?? 0}
            tone="default"
          />
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/users"
          className="block rounded-xl border border-[--admin-border] bg-white p-5 shadow-[var(--admin-shadow-sm)] transition hover:shadow-[var(--admin-shadow)]"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[--admin-text]">
              Все юзеры
            </h3>
            <span className="text-xs text-[--admin-text-muted]">
              {totalUsers ?? 0}
            </span>
          </div>
          <p className="mt-1 text-xs text-[--admin-text-2]">
            Полный список с фильтрами по lifecycle/языку/поиском.
          </p>
        </Link>

        <Link
          href="/admin/banned"
          className="block rounded-xl border border-[--admin-border] bg-white p-5 shadow-[var(--admin-shadow-sm)] transition hover:shadow-[var(--admin-shadow)]"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[--admin-text]">
              Забанены
            </h3>
            <span
              className="text-xs"
              style={{
                color:
                  (blockedCount ?? 0) > 0
                    ? "var(--admin-danger)"
                    : "var(--admin-text-muted)",
              }}
            >
              {blockedCount ?? 0}
            </span>
          </div>
          <p className="mt-1 text-xs text-[--admin-text-2]">
            Заблокированные юзеры, восстановление доступа.
          </p>
        </Link>

        <Link
          href="/admin/audit"
          className="block rounded-xl border border-[--admin-border] bg-white p-5 shadow-[var(--admin-shadow-sm)] transition hover:shadow-[var(--admin-shadow)]"
        >
          <h3 className="text-sm font-semibold text-[--admin-text]">Журнал</h3>
          <p className="mt-1 text-xs text-[--admin-text-2]">
            Все переходы состояний с фильтрами.
          </p>
        </Link>

        <Link
          href="/admin/stats"
          className="block rounded-xl border border-[--admin-border] bg-white p-5 shadow-[var(--admin-shadow-sm)] transition hover:shadow-[var(--admin-shadow)]"
        >
          <h3 className="text-sm font-semibold text-[--admin-text]">
            Аналитика
          </h3>
          <p className="mt-1 text-xs text-[--admin-text-2]">
            Воронка онбординга, конверсии, тренды.
          </p>
        </Link>
      </section>
    </AdminShell>
  );
}
