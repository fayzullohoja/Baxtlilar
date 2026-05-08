/**
 * Integration test for transition() optimistic concurrency.
 * Two simultaneous transitions on the same user — one wins, one throws.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const RUN = process.env.RUN_INTEGRATION === "1";
const d = RUN ? describe : describe.skip;

let supa: SupabaseClient;
const createdUserIds: string[] = [];

async function makeUser(): Promise<string> {
  const tgId = Math.floor(Math.random() * 1_000_000_000) + 6_000_000_000;
  const { data, error } = await supa
    .from("users")
    .insert({ telegram_id: tgId, telegram_first_name: "TransitionTest" })
    .select("id")
    .single();
  if (error) throw error;
  createdUserIds.push(data!.id);
  return data!.id;
}

beforeAll(async () => {
  if (!RUN) return;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE) {
    throw new Error("env not loaded — source .env.local");
  }
  const { createClient } = await import("@supabase/supabase-js");
  supa = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});

afterAll(async () => {
  if (!RUN) return;
  await Promise.all(
    createdUserIds.map((id) => supa.from("users").delete().eq("id", id)),
  );
}, 60_000);

d("transition() concurrency", () => {
  it("happy path: single transition succeeds + writes audit", async () => {
    const userId = await makeUser();
    const { transition } = await import("../state-machine/transitions");

    await transition(
      userId,
      { onboarding_step: "phone_input" },
      "test happy",
      "system",
    );

    const { data: u } = await supa
      .from("users")
      .select("onboarding_step")
      .eq("id", userId)
      .single();
    expect(u?.onboarding_step).toBe("phone_input");

    const { count } = await supa
      .from("user_state_transitions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(count).toBeGreaterThan(0);
  });

  it("rejects when row was modified concurrently", async () => {
    const userId = await makeUser();
    const { transition } = await import("../state-machine/transitions");

    // Race-condition simulation: bump updated_at out-of-band, then transition()
    // should see updated_at mismatch and throw.

    // First, do a normal transition to capture its updated_at
    await transition(
      userId,
      { onboarding_step: "phone_input" },
      "step 1",
      "system",
    );

    const { data: snap1 } = await supa
      .from("users")
      .select("updated_at")
      .eq("id", userId)
      .single();
    const firstUpdatedAt = snap1?.updated_at;

    // Now bump updated_at via direct mutation that doesn't go through transition()
    await supa
      .from("users")
      .update({ telegram_first_name: "concurrent-edit" })
      .eq("id", userId);

    // The next transition() will snapshot updated_at fresh, so it WILL succeed —
    // we need a different race-condition test. Let's start two transitions in
    // parallel and assert exactly one fails.

    const r = await Promise.allSettled([
      transition(
        userId,
        { onboarding_step: "otp_pending" },
        "race A",
        "system",
      ),
      transition(
        userId,
        { onboarding_step: "verification_intro" },
        "race B",
        "system",
      ),
    ]);

    // One MUST fail with our concurrency error; the other succeeds.
    const fulfilled = r.filter((x) => x.status === "fulfilled").length;
    const rejected = r.filter((x) => x.status === "rejected").length;
    expect(fulfilled).toBe(1);
    expect(rejected).toBe(1);

    const failed = r.find((x) => x.status === "rejected");
    if (failed?.status === "rejected") {
      expect(String(failed.reason)).toContain("transition_conflict");
    }
    expect(firstUpdatedAt).toBeTruthy();
  });
});
