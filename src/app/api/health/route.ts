import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface HealthResponse {
  status: "ok" | "degraded" | "down";
  uptime_ms: number;
  checks: {
    db: { ok: boolean; latency_ms?: number; error?: string };
  };
  env: "production" | "preview" | "development";
}

const startedAt = Date.now();

export async function GET() {
  const env =
    (process.env.VERCEL_ENV as HealthResponse["env"]) ?? "development";

  // Cheap DB ping — just count from a small table
  const dbStart = Date.now();
  let dbOk = false;
  let dbErr: string | undefined;
  try {
    const { error } = await supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) {
      dbErr = error.message;
    } else {
      dbOk = true;
    }
  } catch (e) {
    dbErr = e instanceof Error ? e.message : "unknown";
  }
  const dbLatency = Date.now() - dbStart;

  const status: HealthResponse["status"] = dbOk
    ? dbLatency > 1000
      ? "degraded"
      : "ok"
    : "down";

  const body: HealthResponse = {
    status,
    uptime_ms: Date.now() - startedAt,
    checks: {
      db: dbOk
        ? { ok: true, latency_ms: dbLatency }
        : { ok: false, error: dbErr },
    },
    env,
  };

  return NextResponse.json(body, {
    status: status === "down" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
