/**
 * Real HTTP E2E against running `pnpm dev` server.
 * 1. Insert a user via service_role
 * 2. Mint a session cookie matching local SESSION_SECRET
 * 3. For each onboarding step, advance state in DB, then GET / and assert
 *    the dev server redirects to the correct screen.
 *
 * Run after `pnpm dev` is up.
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";

// load env from .env.local
const env = fs.readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET = process.env.SESSION_SECRET;
const BASE = "http://localhost:3000";

const supa = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function mintSessionCookie(userId) {
  const payload = {
    user_id: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

async function probe(cookie, label) {
  const r = await fetch(`${BASE}/`, {
    redirect: "manual",
    headers: { Cookie: `bakht_session=${cookie}` },
  });
  let next = r.headers.get("location") ?? "(no redirect)";
  // follow next-intl redirect once
  if (next?.startsWith("/")) {
    const r2 = await fetch(`${BASE}${next}`, {
      redirect: "manual",
      headers: { Cookie: `bakht_session=${cookie}` },
    });
    if (r2.headers.get("location")) next = r2.headers.get("location");
  }
  console.log(`  [${label}] → ${next}`);
  return next;
}

const passed = [];
const failed = [];
function assert(label, actual, expected) {
  if (actual === expected || actual?.endsWith(expected)) {
    passed.push(label);
    console.log(`    ✓ ${label}`);
  } else {
    failed.push({ label, actual, expected });
    console.log(`    ✗ ${label} — expected ${expected}, got ${actual}`);
  }
}

const TG_ID = Date.now() + Math.floor(Math.random() * 100000);

console.log("\n=== HTTP E2E against http://localhost:3000 ===\n");

// 1. No session → welcome
{
  const r = await fetch(`${BASE}/`, { redirect: "manual" });
  console.log(`  [no-session /] → ${r.headers.get("location")}`);
  const r2 = await fetch(`${BASE}/ru`, { redirect: "manual" });
  assert("no-session → /ru/onboarding/welcome", r2.headers.get("location"), "/ru/onboarding/welcome");
}

// 2. Create user in DB
const { data: user } = await supa
  .from("users")
  .insert({ telegram_id: TG_ID, telegram_first_name: "E2E" })
  .select("id")
  .single();
const cookie = mintSessionCookie(user.id);
console.log(`\n  Created user ${user.id.slice(0, 8)}…, minted cookie\n`);

// 3. Walk onboarding
const STEPS = [
  ["language", "/ru/onboarding/language"],
  ["security_intro", "/ru/onboarding/security"],
  ["phone_input", "/ru/onboarding/phone"],
  ["otp_pending", "/ru/onboarding/otp"],
  ["verification_intro", "/ru/onboarding/verification-intro"],
  ["document_upload", "/ru/onboarding/document"],
  ["liveness_upload", "/ru/onboarding/liveness"],
  ["moderation_submitted", "/ru/onboarding/moderation/submitted"],
  ["moderation_pending", "/ru/onboarding/moderation/pending"],
  ["verification_rejected", "/ru/onboarding/moderation/rejected"],
  ["profile_basic", "/ru/onboarding/profile/basic"],
  ["profile_photos", "/ru/onboarding/profile/photos"],
  ["profile_education", "/ru/onboarding/profile/education"],
  ["profile_family", "/ru/onboarding/profile/family"],
  ["profile_values", "/ru/onboarding/profile/values"],
  ["profile_looking_for", "/ru/onboarding/profile/looking-for"],
  ["profile_about", "/ru/onboarding/profile/about"],
  ["profile_preview", "/ru/onboarding/profile/preview"],
  ["quiz_intro", "/ru/onboarding/quiz/intro"],
  ["quiz_in_progress", "/ru/onboarding/quiz/q"],
  ["quiz_result", "/ru/onboarding/quiz/result"],
];

for (const [step, expected] of STEPS) {
  await supa
    .from("users")
    .update({ language: "ru", onboarding_step: step })
    .eq("id", user.id);
  const next = await probe(cookie, step);
  assert(`${step} routes to ${expected}`, next, expected);
}

// 4. lifecycle=active → /main
await supa.from("users").update({ lifecycle_state: "active" }).eq("id", user.id);
const next = await probe(cookie, "active");
assert("active → /ru/main", next, "/ru/main");

// 5. lifecycle=blocked → /blocked
await supa.from("users").update({ lifecycle_state: "blocked" }).eq("id", user.id);
const next2 = await probe(cookie, "blocked");
assert("blocked → /ru/blocked", next2, "/ru/blocked");

// 6. Tampered session cookie → no-session redirect
const tampered = cookie.split(".")[0] + ".AAAA";
const r = await fetch(`${BASE}/ru`, {
  redirect: "manual",
  headers: { Cookie: `bakht_session=${tampered}` },
});
assert("tampered cookie → welcome", r.headers.get("location"), "/ru/onboarding/welcome");

// Cleanup
await supa.from("users").delete().eq("id", user.id);

console.log(`\n=== ${passed.length} passed, ${failed.length} failed ===`);
if (failed.length) {
  console.log("\nFailures:");
  for (const f of failed) console.log(`  - ${f.label}: expected ${f.expected}, got ${f.actual}`);
  process.exit(1);
}
