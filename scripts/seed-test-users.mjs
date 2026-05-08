/**
 * Seed N synthetic users at various lifecycle stages for local QA.
 *
 * Run:
 *   node scripts/seed-test-users.mjs            # defaults: 20 users
 *   node scripts/seed-test-users.mjs 50         # 50 users
 *   node scripts/seed-test-users.mjs 50 --reset # remove all "seed_*" users first
 *
 * Each seeded user has telegram_first_name = "Seed N"; cleanup with:
 *   node scripts/seed-test-users.mjs 0 --reset
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const N = Number(process.argv[2] ?? 20);
const RESET = process.argv.includes("--reset");

const STAGES = [
  { state: "onboarding", verification: "not_started", step: "language" },
  { state: "onboarding", verification: "phone_verified", step: "verification_intro" },
  { state: "onboarding", verification: "pending_review", step: "moderation_pending" },
  { state: "onboarding", verification: "approved", step: "profile_basic", profile: "in_progress" },
  { state: "onboarding", verification: "approved", step: "quiz_intro", profile: "completed" },
  { state: "active", verification: "approved", step: "complete", profile: "completed", quiz: "completed" },
  { state: "blocked", verification: "revoked", step: "moderation_pending", blocked_reason: "seed test ban" },
  { state: "paused", verification: "approved", step: "complete", profile: "completed", quiz: "completed" },
];

const FIRST_NAMES_RU = ["Анора", "Рустам", "Нодира", "Алишер", "Мадина", "Бекзод", "Зарина", "Шерзод"];

async function main() {
  if (RESET) {
    const { data: existing } = await supa
      .from("users")
      .select("id")
      .like("telegram_first_name", "Seed %");
    if (existing && existing.length > 0) {
      console.log(`removing ${existing.length} existing seed users…`);
      await supa
        .from("users")
        .delete()
        .in("id", existing.map((u) => u.id));
    } else {
      console.log("no seed users to remove");
    }
    if (N === 0) return;
  }

  console.log(`creating ${N} seed users…`);
  for (let i = 0; i < N; i++) {
    const stage = STAGES[i % STAGES.length];
    const tgId = 999_000_000_000 + Math.floor(Math.random() * 999_999_999);
    const first = FIRST_NAMES_RU[i % FIRST_NAMES_RU.length];

    const row = {
      telegram_id: tgId,
      telegram_first_name: `Seed ${i + 1} ${first}`,
      telegram_username: `seed_${i + 1}`,
      phone_number: `+99890${String(1_000_000 + i).padStart(7, "0")}`,
      phone_verified: stage.verification !== "not_started",
      lifecycle_state: stage.state,
      onboarding_step: stage.step,
      verification_status: stage.verification,
      profile_completion: stage.profile ?? "not_started",
      quiz_completion: stage.quiz ?? "not_started",
      blocked_at: stage.state === "blocked" ? new Date().toISOString() : null,
      blocked_reason: stage.blocked_reason ?? null,
    };
    const { error } = await supa.from("users").insert(row);
    if (error) {
      console.error(`  user ${i + 1}: ${error.message}`);
    } else {
      process.stdout.write(".");
    }
  }
  console.log("\ndone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
