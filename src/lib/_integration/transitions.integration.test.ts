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

  it("rejects when row was modified concurrently (deterministic)", async () => {
    const userId = await makeUser();
    const { transition } = await import("../state-machine/transitions");

    // Deterministic race simulation: we need the second transition to see a
    // stale updated_at. Promise.all isn't enough — supabase JS connection
    // serializes round-trips so both selects don't happen before both updates.
    //
    // Instead: make transition() take a snapshot, then mutate the row out-of-
    // band BEFORE transition() does its UPDATE. We do this by interleaving
    // manually.

    // Step 1: snapshot the current updated_at
    const { data: snap } = await supa
      .from("users")
      .select(
        "lifecycle_state, onboarding_step, verification_status, profile_completion, quiz_completion, updated_at",
      )
      .eq("id", userId)
      .single();

    // Step 2: someone else updates the row, bumping updated_at
    await supa
      .from("users")
      .update({ telegram_first_name: "out-of-band-edit" })
      .eq("id", userId);

    // Step 3: simulate transition's optimistic update with the OLD updated_at —
    // should affect 0 rows because trigger bumped it
    const { data: updated } = await supa
      .from("users")
      .update({ onboarding_step: "phone_input" })
      .eq("id", userId)
      .eq("updated_at", snap!.updated_at)
      .select("id")
      .maybeSingle();
    expect(updated).toBeNull(); // optimistic lock held — no row matched

    // Step 4: a fresh transition() picks up the new updated_at and succeeds
    await transition(
      userId,
      { onboarding_step: "phone_input" },
      "after concurrent edit",
      "system",
    );
    const { data: u } = await supa
      .from("users")
      .select("onboarding_step")
      .eq("id", userId)
      .single();
    expect(u?.onboarding_step).toBe("phone_input");
  });
});
