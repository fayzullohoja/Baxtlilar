import { redirect } from "next/navigation";
import { isAdmin, clearAdminCookie } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AdminShell, StatTile } from "@/components/admin/shell";

interface UserRow {
  id: string;
  lifecycle_state: string;
  verification_status: string;
  onboarding_step: string;
  created_at: string;
  phone_verified: boolean;
}

interface DocRow {
  user_id: string;
  submitted_at: string | null;
  reviewed_at: string | null;
}

const FUNNEL_STEPS: Array<{ key: string; label: string; predicate: (u: UserRow) => boolean }> = [
  { key: "registered", label: "Регистрация", predicate: () => true },
  { key: "phone", label: "Телефон подтверждён", predicate: (u) => u.phone_verified },
  {
    key: "submitted",
    label: "Документы поданы",
    predicate: (u) =>
      ["pending_review", "approved", "rejected", "revoked"].includes(u.verification_status),
  },
  {
    key: "approved",
    label: "Модерация пройдена",
    predicate: (u) => u.verification_status === "approved",
  },
  {
    key: "active",
    label: "Анкета + квиз → активный",
    predicate: (u) => u.lifecycle_state === "active",
  },
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function StatsPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  // Pull all users (small dataset; OK for MVP)
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, lifecycle_state, verification_status, onboarding_step, created_at, phone_verified");

  const { data: docs } = await supabaseAdmin
    .from("user_documents")
    .select("user_id, submitted_at, reviewed_at")
    .not("submitted_at", "is", null)
    .not("reviewed_at", "is", null);

  const allUsers: UserRow[] = users ?? [];
  const allDocs: DocRow[] = docs ?? [];

  // Funnel
  const funnel = FUNNEL_STEPS.map((step) => ({
    key: step.key,
    label: step.label,
    count: allUsers.filter(step.predicate).length,
  }));
  const totalRegistered = funnel[0]?.count ?? 0;

  // Approval rate (excluding still-pending)
  const decided = allUsers.filter((u) =>
    ["approved", "rejected", "revoked"].includes(u.verification_status),
  );
  const approved = decided.filter((u) => u.verification_status === "approved");
  const approvalRate = decided.length > 0 ? Math.round((approved.length / decided.length) * 100) : 0;

  // Avg time-to-approve (median in minutes for stability)
  const approveDurations = allDocs
    .filter((d) => d.submitted_at && d.reviewed_at)
    .map(
      (d) =>
        (new Date(d.reviewed_at!).getTime() - new Date(d.submitted_at!).getTime()) / 60_000,
    )
    .filter((m) => m >= 0)
    .sort((a, b) => a - b);
  const medianApprove =
    approveDurations.length > 0
      ? approveDurations[Math.floor(approveDurations.length / 2)]
      : null;

  function formatDuration(min: number | null): string {
    if (min == null) return "—";
    if (min < 1) return "< 1 мин";
    if (min < 60) return `${Math.round(min)} мин`;
    const h = min / 60;
    if (h < 24) return `${h.toFixed(1)} ч`;
    return `${(h / 24).toFixed(1)} д`;
  }

  // Daily signups for last 30 days
  const today = startOfDay(new Date());
  const days: { date: Date; count: number }[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (29 - i));
    return { date: d, count: 0 };
  });
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const dayMap = new Map(days.map((d) => [dayKey(d.date), d]));
  for (const u of allUsers) {
    const k = dayKey(startOfDay(new Date(u.created_at)));
    const bucket = dayMap.get(k);
    if (bucket) bucket.count++;
  }
  const maxDayCount = Math.max(1, ...days.map((d) => d.count));
  const last7 = days.slice(-7).reduce((s, d) => s + d.count, 0);
  const prev7 = days.slice(-14, -7).reduce((s, d) => s + d.count, 0);
  const trend = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;

  async function logout() {
    "use server";
    await clearAdminCookie();
    redirect("/admin/login");
  }

  return (
    <AdminShell
      title="Аналитика"
      subtitle="Воронка, конверсии и тренды для оценки здоровья сервиса."
      onLogout={logout}
      activeNav="/admin/stats"
    >
      {/* Top metrics */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Регистраций / 7 дней"
          value={last7}
          tone="default"
          hint={
            trend != null
              ? trend >= 0
                ? `+${trend}% к прошлой неделе`
                : `${trend}% к прошлой неделе`
              : "пока без сравнения"
          }
        />
        <StatTile
          label="Approval rate"
          value={`${approvalRate}%`}
          tone={approvalRate >= 70 ? "success" : approvalRate >= 50 ? "warn" : "danger"}
          hint={`${approved.length} из ${decided.length} рассмотренных`}
        />
        <StatTile
          label="Avg time-to-approve"
          value={formatDuration(medianApprove)}
          tone="default"
          hint={`по ${approveDurations.length} заявкам (медиана)`}
        />
        <StatTile
          label="Всего активных"
          value={allUsers.filter((u) => u.lifecycle_state === "active").length}
          tone="success"
          hint={`из ${allUsers.length} зарегистрированных`}
        />
      </section>

      {/* Funnel */}
      <section className="mb-6 overflow-hidden rounded-xl border border-[--admin-border] bg-white shadow-[var(--admin-shadow-sm)]">
        <div className="border-b border-[--admin-border] px-5 py-3">
          <h2 className="text-sm font-semibold text-[--admin-text]">
            Воронка онбординга
          </h2>
          <p className="mt-0.5 text-xs text-[--admin-text-2]">
            Сколько юзеров доходит до каждого этапа
          </p>
        </div>
        <div className="flex flex-col gap-3 px-5 py-5">
          {funnel.map((step, i) => {
            const pct = totalRegistered > 0 ? (step.count / totalRegistered) * 100 : 0;
            const dropoff =
              i > 0 && funnel[i - 1].count > 0
                ? Math.round(((funnel[i - 1].count - step.count) / funnel[i - 1].count) * 100)
                : null;
            return (
              <div key={step.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[--admin-text]">{step.label}</span>
                  <div className="flex items-center gap-3">
                    {dropoff != null && dropoff > 0 ? (
                      <span className="text-xs text-[--admin-danger]">
                        −{dropoff}% drop-off
                      </span>
                    ) : null}
                    <span className="text-sm font-semibold text-[--admin-text]">
                      {step.count}
                    </span>
                    <span className="w-12 text-right text-xs text-[--admin-text-muted]">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full"
                  style={{ backgroundColor: "var(--admin-surface-2)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: i === funnel.length - 1
                        ? "var(--admin-success)"
                        : "var(--admin-accent)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Daily signups */}
      <section className="overflow-hidden rounded-xl border border-[--admin-border] bg-white shadow-[var(--admin-shadow-sm)]">
        <div className="flex items-center justify-between border-b border-[--admin-border] px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[--admin-text]">
              Регистрации по дням
            </h2>
            <p className="mt-0.5 text-xs text-[--admin-text-2]">
              Последние 30 дней
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[--admin-text-muted]">Всего за период</p>
            <p className="text-lg font-semibold tabular-nums text-[--admin-text]">
              {days.reduce((s, d) => s + d.count, 0)}
            </p>
          </div>
        </div>
        <div className="px-5 py-5">
          <div className="flex items-end gap-1" style={{ height: "120px" }}>
            {days.map((d) => {
              const h = (d.count / maxDayCount) * 100;
              const isToday = dayKey(d.date) === dayKey(today);
              return (
                <div
                  key={dayKey(d.date)}
                  className="group relative flex-1 cursor-help"
                  style={{ minWidth: "4px" }}
                  title={`${d.date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}: ${d.count}`}
                >
                  <div
                    className="w-full rounded-t-sm transition group-hover:opacity-80"
                    style={{
                      height: `${Math.max(h, d.count > 0 ? 4 : 0)}%`,
                      backgroundColor: isToday
                        ? "var(--admin-accent)"
                        : "var(--admin-info)",
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-[--admin-text-muted]">
            <span>
              {days[0].date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
            </span>
            <span>сегодня</span>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
