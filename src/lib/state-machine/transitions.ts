import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { OnboardingStep, VerificationStatus, ProfileCompletion, QuizCompletion, LifecycleState } from "./types";

type TransitionFields = Partial<{
  lifecycle_state: LifecycleState;
  onboarding_step: OnboardingStep;
  verification_status: VerificationStatus;
  profile_completion: ProfileCompletion;
  quiz_completion: QuizCompletion;
  language: "ru" | "uz";
  phone_number: string;
  phone_verified: boolean;
  phone_verified_at: string;
  security_intro_seen: boolean;
  blocked_at: string | null;
  blocked_reason: string | null;
  paused_at: string | null;
}>;

export async function transition(
  userId: string,
  patch: TransitionFields,
  reason: string,
  triggeredBy: "user" | "admin" | "system" = "user",
) {
  const { data: before, error: beforeErr } = await supabaseAdmin
    .from("users")
    .select("lifecycle_state, onboarding_step, verification_status, profile_completion, quiz_completion")
    .eq("id", userId)
    .single();
  if (beforeErr) throw beforeErr;

  const { error: updErr } = await supabaseAdmin
    .from("users")
    .update(patch)
    .eq("id", userId);
  if (updErr) throw updErr;

  const auditRows = (Object.keys(patch) as Array<keyof TransitionFields>)
    .filter((f) =>
      ["lifecycle_state", "onboarding_step", "verification_status", "profile_completion", "quiz_completion"].includes(
        f as string,
      ),
    )
    .map((f) => ({
      user_id: userId,
      field: f,
      old_value: String(before?.[f as keyof typeof before] ?? ""),
      new_value: String(patch[f]),
      reason,
      triggered_by: triggeredBy,
    }));
  if (auditRows.length) {
    await supabaseAdmin.from("user_state_transitions").insert(auditRows);
  }
}
