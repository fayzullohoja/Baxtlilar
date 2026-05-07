/**
 * Integration test against real Supabase. Skipped by default.
 * Run: RUN_INTEGRATION=1 pnpm test
 *
 * Walks the entire happy-path: bootstrap → phone → OTP → docs → moderation
 * → profile sections → quiz → active. Asserts DB state after each step.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const RUN = process.env.RUN_INTEGRATION === "1";
const d = RUN ? describe : describe.skip;

const TG_ID = Math.floor(Math.random() * 1_000_000_000) + 9_000_000_000;
let supa: SupabaseClient;

let userId = "";

async function fetchUser() {
  const { data } = await supa
    .from("users")
    .select(
      "lifecycle_state, onboarding_step, verification_status, profile_completion, quiz_completion, language, phone_number, phone_verified",
    )
    .eq("id", userId)
    .single();
  return data!;
}

d("Onboarding happy-path against real Supabase", () => {
  beforeAll(async () => {
    if (!RUN) return;
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE) throw new Error("env not loaded — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    const { createClient } = await import("@supabase/supabase-js");
    supa = createClient(SUPABASE_URL, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supa
      .from("users")
      .insert({
        telegram_id: TG_ID,
        telegram_first_name: "IntegrationTest",
      })
      .select("id")
      .single();
    if (error) throw error;
    userId = data!.id;
  });

  afterAll(async () => {
    if (!RUN || !userId) return;
    // cascade deletes via on-delete-cascade FKs cleans up everything
    await supa.from("users").delete().eq("id", userId);
  });

  it("starts as onboarding/language", async () => {
    const u = await fetchUser();
    expect(u.lifecycle_state).toBe("onboarding");
    expect(u.onboarding_step).toBe("language");
    expect(u.verification_status).toBe("not_started");
  });

  it("transitions to security_intro after language pick", async () => {
    await supa
      .from("users")
      .update({ language: "ru", onboarding_step: "security_intro" })
      .eq("id", userId);
    const u = await fetchUser();
    expect(u.language).toBe("ru");
    expect(u.onboarding_step).toBe("security_intro");
  });

  it("phone input → otp_pending", async () => {
    await supa
      .from("users")
      .update({
        phone_number: `+998${String(TG_ID).slice(-9)}`,
        onboarding_step: "otp_pending",
      })
      .eq("id", userId);
    const u = await fetchUser();
    expect(u.phone_number).toMatch(/^\+998\d{9}$/);
    expect(u.onboarding_step).toBe("otp_pending");
  });

  it("OTP code is hashed in otp_codes", async () => {
    const code = "123456";
    const crypto = await import("node:crypto");
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    const { error } = await supa.from("otp_codes").insert({
      user_id: userId,
      phone_number: `+998${String(TG_ID).slice(-9)}`,
      code_hash: hash,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    expect(error).toBeNull();
    const { data } = await supa
      .from("otp_codes")
      .select("code_hash, attempts")
      .eq("user_id", userId)
      .single();
    expect(data?.code_hash).toBe(hash);
    expect(data?.attempts).toBe(0);
  });

  it("phone verified → verification_intro", async () => {
    await supa
      .from("users")
      .update({
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
        verification_status: "phone_verified",
        onboarding_step: "verification_intro",
      })
      .eq("id", userId);
    const u = await fetchUser();
    expect(u.phone_verified).toBe(true);
    expect(u.verification_status).toBe("phone_verified");
  });

  it("passport upload writes user_documents row", async () => {
    await supa.from("user_documents").upsert(
      {
        user_id: userId,
        passport_path: `${userId}/passport-test.jpg`,
        passport_uploaded_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    await supa
      .from("users")
      .update({
        verification_status: "documents_uploaded",
        onboarding_step: "liveness_upload",
      })
      .eq("id", userId);
    const { data } = await supa
      .from("user_documents")
      .select("passport_path")
      .eq("user_id", userId)
      .single();
    expect(data?.passport_path).toMatch(/passport-test/);
  });

  it("selfie upload + submission → pending_review", async () => {
    await supa.from("user_documents").update({
      selfie_path: `${userId}/selfie-test.jpg`,
      selfie_uploaded_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    }).eq("user_id", userId);
    await supa
      .from("users")
      .update({
        verification_status: "pending_review",
        onboarding_step: "moderation_pending",
      })
      .eq("id", userId);
    const u = await fetchUser();
    expect(u.verification_status).toBe("pending_review");
  });

  it("moderator approves → profile_basic", async () => {
    await supa.from("user_documents").update({
      reviewed_at: new Date().toISOString(),
    }).eq("user_id", userId);
    await supa
      .from("users")
      .update({
        verification_status: "approved",
        onboarding_step: "profile_basic",
        profile_completion: "in_progress",
      })
      .eq("id", userId);
    const u = await fetchUser();
    expect(u.verification_status).toBe("approved");
    expect(u.profile_completion).toBe("in_progress");
  });

  it("profile_basic data persists with correct enum types", async () => {
    await supa.from("user_profiles").upsert(
      {
        user_id: userId,
        display_name: "Anora",
        birth_date: "1995-04-15",
        gender: "female",
        city: "Tashkent",
        marital_status: "never_married",
        currently_married: false,
      },
      { onConflict: "user_id" },
    );
    const { data } = await supa
      .from("user_profiles")
      .select("display_name, gender, marital_status")
      .eq("user_id", userId)
      .single();
    expect(data?.display_name).toBe("Anora");
    expect(data?.gender).toBe("female");
    expect(data?.marital_status).toBe("never_married");
  });

  it("interests array persists as text[]", async () => {
    await supa
      .from("user_profiles")
      .update({
        interests: ["family", "sport", "books"],
      })
      .eq("user_id", userId);
    const { data } = await supa
      .from("user_profiles")
      .select("interests")
      .eq("user_id", userId)
      .single();
    expect(Array.isArray(data?.interests)).toBe(true);
    expect(data?.interests).toContain("family");
    expect(data?.interests).toHaveLength(3);
  });

  it("looking_for fields persist", async () => {
    await supa
      .from("user_profiles")
      .update({
        looking_for_gender: "male",
        preferred_age_min: 28,
        preferred_age_max: 40,
        preferred_partner_qualities: ["responsibility", "kindness", "honesty"],
      })
      .eq("user_id", userId);
    const { data } = await supa
      .from("user_profiles")
      .select("preferred_age_min, preferred_age_max, preferred_partner_qualities")
      .eq("user_id", userId)
      .single();
    expect(data?.preferred_age_min).toBe(28);
    expect(data?.preferred_age_max).toBe(40);
    expect(data?.preferred_partner_qualities).toHaveLength(3);
  });

  it("profile preview confirm → quiz_intro + completed", async () => {
    await supa
      .from("user_profiles")
      .update({ profile_completed_at: new Date().toISOString() })
      .eq("user_id", userId);
    await supa
      .from("users")
      .update({
        profile_completion: "completed",
        onboarding_step: "quiz_intro",
      })
      .eq("id", userId);
    const u = await fetchUser();
    expect(u.profile_completion).toBe("completed");
    expect(u.onboarding_step).toBe("quiz_intro");
  });

  it("quiz_answers store with composite PK (no duplicates)", async () => {
    const answers = [
      { user_id: userId, question_id: "q1_intention", answer: "marriage" },
      { user_id: userId, question_id: "q4_values", answer: ["family", "respect", "stability"] },
    ];
    for (const a of answers) await supa.from("quiz_answers").upsert(a, { onConflict: "user_id,question_id" });
    // upsert same question_id again — should update, not duplicate
    await supa
      .from("quiz_answers")
      .upsert(
        { user_id: userId, question_id: "q1_intention", answer: "serious" },
        { onConflict: "user_id,question_id" },
      );
    const { data, count } = await supa
      .from("quiz_answers")
      .select("question_id, answer", { count: "exact" })
      .eq("user_id", userId);
    expect(count).toBe(2);
    const intention = data?.find((r) => r.question_id === "q1_intention");
    expect(intention?.answer).toBe("serious");
  });

  it("quiz_results compute + persist", async () => {
    const { computeQuizResult } = await import("../quiz/scoring");
    const { data: rows } = await supa
      .from("quiz_answers")
      .select("question_id, answer")
      .eq("user_id", userId);
    const map: Record<string, string | string[]> = {};
    for (const r of rows ?? []) map[r.question_id] = r.answer as string | string[];
    const result = computeQuizResult(map);
    await supa.from("quiz_results").upsert({ user_id: userId, ...result }, { onConflict: "user_id" });
    const { data } = await supa
      .from("quiz_results")
      .select("intention_type, family_values_score")
      .eq("user_id", userId)
      .single();
    expect(data?.intention_type).toBe("серьёзное знакомство");
    expect(Number(data?.family_values_score)).toBeGreaterThanOrEqual(2);
  });

  it("onboarding complete → lifecycle active", async () => {
    await supa
      .from("users")
      .update({
        quiz_completion: "completed",
        lifecycle_state: "active",
        onboarding_step: "complete",
      })
      .eq("id", userId);
    const u = await fetchUser();
    expect(u.lifecycle_state).toBe("active");
    expect(u.quiz_completion).toBe("completed");
  });

  it("nextScreenFor() routes active user to /main", async () => {
    const { nextScreenFor } = await import("../state-machine/router");
    const u = await fetchUser();
    expect(nextScreenFor({
      id: userId,
      telegram_id: TG_ID,
      language: u.language,
      phone_number: u.phone_number,
      phone_verified: u.phone_verified,
      lifecycle_state: u.lifecycle_state,
      onboarding_step: u.onboarding_step,
      verification_status: u.verification_status,
      profile_completion: u.profile_completion,
      quiz_completion: u.quiz_completion,
      security_intro_seen: false,
    })).toBe("/main");
  });

  it("storage: real upload to documents bucket + signed URL works", async () => {
    const path = `${userId}/passport-real.jpg`;
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const { error: upErr } = await supa.storage
      .from("documents")
      .upload(path, fakeJpeg, { contentType: "image/jpeg", upsert: true });
    expect(upErr).toBeNull();

    const { data, error: signErr } = await supa.storage
      .from("documents")
      .createSignedUrl(path, 60);
    expect(signErr).toBeNull();
    expect(data?.signedUrl).toContain("/object/sign/documents/");

    // Cleanup
    await supa.storage.from("documents").remove([path]);
  });
});
