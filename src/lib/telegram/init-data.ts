import "server-only";
import crypto from "node:crypto";

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface ParsedInitData {
  user?: TelegramUser;
  auth_date?: number;
  hash?: string;
  raw: Record<string, string>;
}

/**
 * Parses Telegram Mini App initData query string.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function parseInitData(initData: string): ParsedInitData {
  const params = new URLSearchParams(initData);
  const raw: Record<string, string> = {};
  params.forEach((v, k) => (raw[k] = v));
  const userJson = params.get("user");
  let user: TelegramUser | undefined;
  if (userJson) {
    try {
      user = JSON.parse(userJson);
    } catch {}
  }
  return {
    user,
    auth_date: raw.auth_date ? Number(raw.auth_date) : undefined,
    hash: raw.hash,
    raw,
  };
}

/**
 * HMAC-validates initData against TELEGRAM_BOT_TOKEN.
 * Returns parsed data if valid, null otherwise.
 * In DEV_BYPASS_TG=1 mode, skips validation and returns parsed data as-is.
 */
export function validateInitData(initData: string): ParsedInitData | null {
  if (process.env.DEV_BYPASS_TG === "1") {
    return parseInitData(initData);
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN not set and DEV_BYPASS_TG is off");
  }
  const parsed = parseInitData(initData);
  if (!parsed.hash) return null;

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const dataCheckString = Object.keys(parsed.raw)
    .filter((k) => k !== "hash")
    .sort()
    .map((k) => `${k}=${parsed.raw[k]}`)
    .join("\n");
  const computed = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (computed !== parsed.hash) return null;

  // Reject stale (older than 24h)
  if (parsed.auth_date && Date.now() / 1000 - parsed.auth_date > 86400) return null;

  return parsed;
}

/**
 * For DEV_BYPASS_TG mode: synthesizes a fake init data for a given telegram_id.
 * Used when opening the app outside of Telegram in dev.
 */
export function devFakeInitData(tgId = 1, firstName = "DevUser"): string {
  const user = { id: tgId, first_name: firstName };
  const params = new URLSearchParams({
    user: JSON.stringify(user),
    auth_date: String(Math.floor(Date.now() / 1000)),
    hash: "dev",
  });
  return params.toString();
}
