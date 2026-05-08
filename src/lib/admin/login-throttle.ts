import "server-only";
import { headers } from "next/headers";

/**
 * Simple in-memory IP throttler for /admin/login. Survives within a single
 * Vercel function instance; resets on cold start. Goal: slow down brute-force
 * attempts, not 100% block. Pair with a strong ADMIN_SECRET.
 */

const MAX_FAILS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

interface Bucket {
  fails: number;
  firstFailAt: number;
  lockedUntil: number;
}

const buckets = new Map<string, Bucket>();

async function clientIp(override?: string): Promise<string> {
  if (override) return override;
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function isThrottled(ipOverride?: string): Promise<boolean> {
  const ip = await clientIp(ipOverride);
  const b = buckets.get(ip);
  if (!b) return false;
  if (b.lockedUntil > Date.now()) return true;
  if (Date.now() - b.firstFailAt > WINDOW_MS) {
    buckets.delete(ip);
    return false;
  }
  return false;
}

export async function recordLoginFailure(ipOverride?: string): Promise<void> {
  const ip = await clientIp(ipOverride);
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.firstFailAt > WINDOW_MS) {
    buckets.set(ip, { fails: 1, firstFailAt: now, lockedUntil: 0 });
    return;
  }
  b.fails++;
  if (b.fails >= MAX_FAILS) {
    b.lockedUntil = now + LOCKOUT_MS;
  }
}

export async function recordLoginSuccess(ipOverride?: string): Promise<void> {
  const ip = await clientIp(ipOverride);
  buckets.delete(ip);
}
