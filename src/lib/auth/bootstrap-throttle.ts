import "server-only";
import { headers } from "next/headers";

/**
 * In-memory rate limiter for welcome bootstrap. Prevents drive-by spam
 * attempting to create many fake users from a single IP. Resets on cold
 * start; pair with phone OTP for real anti-fraud.
 */

const MAX_BOOTSTRAPS_PER_HOUR = 10;
const WINDOW_MS = 60 * 60 * 1000;

interface Bucket {
  count: number;
  firstAt: number;
}

const buckets = new Map<string, Bucket>();

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function isBootstrapAllowed(ipOverride?: string): Promise<boolean> {
  const ip = ipOverride ?? (await clientIp());
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.firstAt > WINDOW_MS) return true;
  return b.count < MAX_BOOTSTRAPS_PER_HOUR;
}

export async function recordBootstrap(ipOverride?: string): Promise<void> {
  const ip = ipOverride ?? (await clientIp());
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.firstAt > WINDOW_MS) {
    buckets.set(ip, { count: 1, firstAt: now });
    return;
  }
  b.count++;
}
