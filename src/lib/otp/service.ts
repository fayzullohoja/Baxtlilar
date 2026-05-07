import "server-only";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

const OTP_TTL_SECONDS = 5 * 60;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function sendOtp(userId: string, phone: string): Promise<void> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  // invalidate previous active codes
  await supabaseAdmin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("consumed_at", null);

  await supabaseAdmin.from("otp_codes").insert({
    user_id: userId,
    phone_number: phone,
    code_hash: hashCode(code),
    expires_at: expiresAt,
  });

  if (process.env.SMS_PROVIDER === "mock" || !process.env.SMS_PROVIDER) {
    console.log(`[otp:mock] phone=${phone} code=${code} (or use 123456 in dev)`);
  } else {
    // TODO: integrate Eskiz / Playmobile / Twilio
    console.warn(`[otp] SMS_PROVIDER=${process.env.SMS_PROVIDER} not implemented`);
  }
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "too_many" | "no_active" };

export async function verifyOtp(userId: string, code: string): Promise<OtpVerifyResult> {
  const trimmed = code.replace(/\D/g, "");
  if (!/^\d{6}$/.test(trimmed)) return { ok: false, reason: "invalid" };

  // Dev shortcut
  if (
    (process.env.SMS_PROVIDER === "mock" || !process.env.SMS_PROVIDER) &&
    trimmed === "123456"
  ) {
    await consumeAnyActiveOtp(userId);
    return { ok: true };
  }

  const { data: row } = await supabaseAdmin
    .from("otp_codes")
    .select("id, code_hash, attempts, max_attempts, expires_at")
    .eq("user_id", userId)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return { ok: false, reason: "no_active" };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (row.attempts >= row.max_attempts) {
    return { ok: false, reason: "too_many" };
  }

  if (hashCode(trimmed) !== row.code_hash) {
    await supabaseAdmin
      .from("otp_codes")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return { ok: false, reason: "invalid" };
  }

  await supabaseAdmin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);
  return { ok: true };
}

async function consumeAnyActiveOtp(userId: string) {
  await supabaseAdmin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("consumed_at", null);
}
