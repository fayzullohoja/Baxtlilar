import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  OnboardingStep,
  VerificationStatus,
  ProfileCompletion,
  QuizCompletion,
  LifecycleState,
} from "./types";

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

const AUDITABLE_FIELDS = new Set([
  "lifecycle_state",
  "onboarding_step",
  "verification_status",
  "profile_completion",
  "quiz_completion",
]);

/**
 * Atomically advances user state.
 *
 * Optimistic concurrency: snapshot the row first, then UPDATE with a
 * `updated_at = before.updated_at` filter. If another request mutated the row
 * meanwhile, our update affects 0 rows and we throw — the caller can decide
 * whether to retry or surface an error to the user.
 *
 * Audit log writes happen only after the update succeeds, so we never end up
 * with an audit row that doesn't match real DB state.
 */
export async function transition(
  userId: string,
  patch: TransitionFields,
  reason: string,
  triggeredBy: "user" | "admin" | "system" = "user",
) {
  const { data: before, error: beforeErr } = await supabaseAdmin
    .from("users")
    .select(
      "lifecycle_state, onboarding_step, verification_status, profile_completion, quiz_completion, updated_at",
    )
    .eq("id", userId)
    .single();
  if (beforeErr) throw beforeErr;

  // Optimistic concurrency: only update if updated_at hasn't changed since
  // our snapshot. This guards against admin and user (or two admins)
  // racing on the same record.
  const { data: updated, error: updErr } = await supabaseAdmin
    .from("users")
    .update(patch)
    .eq("id", userId)
    .eq("updated_at", before.updated_at)
    .select("id")
    .maybeSingle();
  if (updErr) throw updErr;
  if (!updated) {
    throw new Error("transition_conflict: user state changed concurrently");
  }

  const auditRows = (Object.keys(patch) as Array<keyof TransitionFields>)
    .filter((f) => AUDITABLE_FIELDS.has(f as string))
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
