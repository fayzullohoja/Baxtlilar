import { redirect } from "next/navigation";
import { isAdmin, clearAdminCookie } from "@/lib/admin/guard";
import { isMaintenanceMode } from "@/lib/maintenance";
import { AdminShell, StatusBadge } from "@/components/admin/shell";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  // DB ping (Date.now is per-request server time, not memoizable here)
  // eslint-disable-next-line react-hooks/purity -- request-time clock for latency
  const t0 = Date.now();
  let dbOk = false;
  let dbErr: string | null = null;
  try {
    const { error } = await supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true });
    if (error) dbErr = error.message;
    else dbOk = true;
  } catch (e) {
    dbErr = e instanceof Error ? e.message : "unknown";
  }
  // eslint-disable-next-line react-hooks/purity -- request-time clock for latency
  const dbLatency = Date.now() - t0;

  const env = (process.env.VERCEL_ENV ?? "development") as
    | "production"
    | "preview"
    | "development";

  const buildInfo = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "—",
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? "—",
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? "—",
    region: process.env.VERCEL_REGION ?? "—",
    nodeVersion: process.version,
  };

  const flags = {
    DEV_BYPASS_TG: process.env.DEV_BYPASS_TG === "1",
    SMS_PROVIDER: process.env.SMS_PROVIDER ?? "(unset)",
    MAINTENANCE_MODE: isMaintenanceMode(),
    OTP_DISABLE_RATE_LIMIT: process.env.OTP_DISABLE_RATE_LIMIT === "1",
    HAS_ADMIN_TG_CHAT_ID: Boolean(process.env.ADMIN_TG_CHAT_ID),
  };

  async function logout() {
    "use server";
    await clearAdminCookie();
    redirect("/admin/login");
  }

  return (
    <AdminShell
      title="Системная диагностика"
      subtitle="Состояние деплоя, подключение к БД, активные feature-флаги."
      onLogout={logout}
      activeNav="/admin/system"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Build */}
        <Section title="Сборка">
          <Row label="Окружение" value={env} mono />
          <Row label="Git commit" value={buildInfo.commit} mono />
          <Row label="Ветка" value={buildInfo.branch} mono />
          <Row label="Deployment ID" value={buildInfo.deploymentId} mono />
          <Row label="Region" value={buildInfo.region} mono />
          <Row label="Node" value={buildInfo.nodeVersion} mono />
        </Section>

        {/* DB */}
        <Section title="База данных">
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-xs text-[--admin-text-muted]">Статус</span>
            <StatusBadge
              label={dbOk ? `OK · ${dbLatency} мс` : "DOWN"}
              tone={dbOk ? (dbLatency > 500 ? "warn" : "success") : "danger"}
            />
          </div>
          {dbErr ? (
            <p className="px-5 pb-3 text-xs text-[--admin-danger]">{dbErr}</p>
          ) : null}
        </Section>

        {/* Feature flags */}
        <Section title="Feature-флаги">
          {Object.entries(flags).map(([k, v]) => (
            <Row
              key={k}
              label={k}
              value={typeof v === "boolean" ? (v ? "ON" : "OFF") : String(v)}
              mono
              tone={
                typeof v === "boolean"
                  ? v
                    ? k === "MAINTENANCE_MODE"
                      ? "warn"
                      : k === "OTP_DISABLE_RATE_LIMIT" && env === "production"
                        ? "danger"
                        : "success"
                    : "default"
                  : undefined
              }
            />
          ))}
        </Section>

        {/* Health link */}
        <Section title="Внешние ресурсы">
          <div className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
            <span className="text-[--admin-text-muted]">/api/health</span>
            <a
              href="/api/health"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[--admin-info] hover:underline"
            >
              открыть JSON →
            </a>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[--admin-border] px-5 py-3 text-xs">
            <span className="text-[--admin-text-muted]">Vercel deployment</span>
            <a
              href={`https://vercel.com/dashboard/deployments/${buildInfo.deploymentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[--admin-info] hover:underline"
            >
              открыть →
            </a>
          </div>
        </Section>
      </div>
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[--admin-border] bg-white shadow-[var(--admin-shadow-sm)]">
      <div className="border-b border-[--admin-border] bg-[--admin-surface-2] px-5 py-3">
        <p className="text-sm font-semibold text-[--admin-text]">{title}</p>
      </div>
      <div className="divide-y divide-[--admin-border]">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "default" | "warn" | "success" | "danger";
}) {
  const toneColor =
    tone === "warn"
      ? "var(--admin-warn)"
      : tone === "success"
        ? "var(--admin-success)"
        : tone === "danger"
          ? "var(--admin-danger)"
          : "var(--admin-text)";
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <span className="text-xs text-[--admin-text-muted]">{label}</span>
      <span
        className={`text-sm ${mono ? "font-mono text-xs" : ""}`}
        style={{ color: toneColor }}
      >
        {value}
      </span>
    </div>
  );
}
