/**
 * Admin-only CSV export of all users. Streams down as a download.
 * Requires the bakht_admin cookie.
 *
 * Columns:
 *   id, telegram_id, telegram_username, telegram_first_name, phone_number,
 *   language, lifecycle_state, verification_status, profile_completion,
 *   quiz_completion, created_at, last_active_at, blocked_at, blocked_reason
 */
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "id",
  "telegram_id",
  "telegram_username",
  "telegram_first_name",
  "phone_number",
  "language",
  "lifecycle_state",
  "verification_status",
  "profile_completion",
  "quiz_completion",
  "created_at",
  "last_active_at",
  "blocked_at",
  "blocked_reason",
];

function escapeCsv(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from("users")
    .select(COLUMNS.join(", "))
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const lines = [COLUMNS.join(",")];
  for (const row of rows ?? []) {
    const r = row as unknown as Record<string, unknown>;
    lines.push(COLUMNS.map((c) => escapeCsv(r[c])).join(","));
  }
  const csv = lines.join("\n");

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bakhtlilar-users-${date}.csv"`,
      "cache-control": "no-store",
    },
  });
}
