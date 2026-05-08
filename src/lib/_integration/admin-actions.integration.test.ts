/**
 * Integration tests for admin lifecycle actions: ban → unban, reset.
 * Hits real Supabase. Skipped without RUN_INTEGRATION=1.
 *
 * These don't go through the page server actions (those depend on
 * cookies/headers); they exercise the underlying transition() calls
 * with the same patches that the actions would build.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const RUN = process.env.RUN_INTEGRATION === "1";
const d = RUN ? describe : describe.skip;

let supa: SupabaseClient;
const createdUserIds: string[] = [];

async function makeUser(verificationStatus = "approved", lifecycleState = "active"): Promise<string> {
  const tgId = Math.floor(Math.random() * 1_000_000_000) + 5_000_000_000;
  const { data, error } = await supa
    .from("users")
    .insert({
      telegram_id: tgId,
      telegram_first_name: "AdminActionTest",
      verification_status: verificationStatus,
      lifecycle_state: lifecycleState,
    })
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

d("admin actions (real Supabase)", () => {
  it("ban: sets lifecycle=blocked, verification=revoked, blocked_at, blocked_reason", async () => {
    const userId = await makeUser();
    const { transition } = await import("../state-machine/transitions");

    await transition(
      userId,
      {
        lifecycle_state: "blocked",
        verification_status: "revoked",
        blocked_at: new Date().toISOString(),
        blocked_reason: "test ban",
      },
      "test ban",
      "admin",
    );

    const { data: u } = await supa
      .from("users")
      .select("lifecycle_state, verification_status, blocked_at, blocked_reason")
      .eq("id", userId)
      .single();
    expect(u?.lifecycle_state).toBe("blocked");
    expect(u?.verification_status).toBe("revoked");
    expect(u?.blocked_reason).toBe("test ban");
    expect(u?.blocked_at).toBeTruthy();

    // Audit row written
    const { data: audit } = await supa
      .from("user_state_transitions")
      .select("field, new_value, triggered_by, reason")
      .eq("user_id", userId);
    const lifecycle = audit?.find((a) => a.field === "lifecycle_state");
    expect(lifecycle?.new_value).toBe("blocked");
    expect(lifecycle?.triggered_by).toBe("admin");
  });

  it("unban: restore active user with completed profile + quiz", async () => {
    const userId = await makeUser("approved", "blocked");
    // Mark profile + quiz completed (as if they finished onboarding)
    await supa
      .from("users")
      .update({
        profile_completion: "completed",
        quiz_completion: "completed",
        blocked_at: new Date().toISOString(),
        blocked_reason: "before unban",
      })
      .eq("id", userId);

    const { transition } = await import("../state-machine/transitions");
    await transition(
      userId,
      {
        lifecycle_state: "active",
        verification_status: "approved",
        blocked_at: null,
        blocked_reason: null,
      },
      "test unban",
      "admin",
    );

    const { data: u } = await supa
      .from("users")
      .select("lifecycle_state, blocked_at, blocked_reason")
      .eq("id", userId)
      .single();
    expect(u?.lifecycle_state).toBe("active");
    expect(u?.blocked_at).toBeNull();
    expect(u?.blocked_reason).toBeNull();
  });

  it("reset: bumps user back to profile_basic with in_progress profile completion", async () => {
    const userId = await makeUser("approved", "active");
    await supa
      .from("users")
      .update({
        profile_completion: "completed",
        quiz_completion: "completed",
        onboarding_step: "complete",
      })
      .eq("id", userId);

    const { transition } = await import("../state-machine/transitions");
    await transition(
      userId,
      {
        lifecycle_state: "onboarding",
        onboarding_step: "profile_basic",
        profile_completion: "in_progress",
        quiz_completion: "not_started",
        verification_status: "approved",
      },
      "test reset",
      "admin",
    );

    const { data: u } = await supa
      .from("users")
      .select(
        "lifecycle_state, onboarding_step, profile_completion, quiz_completion",
      )
      .eq("id", userId)
      .single();
    expect(u?.lifecycle_state).toBe("onboarding");
    expect(u?.onboarding_step).toBe("profile_basic");
    expect(u?.profile_completion).toBe("in_progress");
    expect(u?.quiz_completion).toBe("not_started");
  });
});
