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

/**
 * Rate limit: at most 1 OTP send per user per minute, max 5 sends per hour.
 * Real SMS providers cost money — uncapped sending is a wallet/abuse vector.
 */
const RATE_LIMIT_PER_MINUTE_MS = 60 * 1000;
const RATE_LIMIT_PER_HOUR = 5;

export type SendOtpResult =
  | { ok: true }
  | { ok: false; reason: "rate_limit_minute" | "rate_limit_hour" };

export async function sendOtp(userId: string, phone: string): Promise<SendOtpResult> {
  // Tests opt-out of rate limiting; never honored in production.
  const skipRateLimit =
    process.env.OTP_DISABLE_RATE_LIMIT === "1" &&
    process.env.NODE_ENV !== "production";

  if (skipRateLimit) {
    return doSendOtp(userId, phone);
  }

  // 1. Reject if last code was sent < 1 minute ago
  const { data: lastCode } = await supabaseAdmin
    .from("otp_codes")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    lastCode &&
    Date.now() - new Date(lastCode.created_at).getTime() < RATE_LIMIT_PER_MINUTE_MS
  ) {
    return { ok: false, reason: "rate_limit_minute" };
  }

  // 2. Reject if 5+ codes sent in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: hourly } = await supabaseAdmin
    .from("otp_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneHourAgo);
  if ((hourly ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return { ok: false, reason: "rate_limit_hour" };
  }

  return doSendOtp(userId, phone);
}

async function doSendOtp(userId: string, phone: string): Promise<SendOtpResult> {
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

  return { ok: true };
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
