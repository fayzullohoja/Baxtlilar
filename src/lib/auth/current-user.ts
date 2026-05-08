import "server-only";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUserId } from "./session";
import type { UserState, OnboardingStep } from "@/lib/state-machine/types";
import { nextScreenFor } from "@/lib/state-machine/router";
import { isMaintenanceMode } from "@/lib/maintenance";

export async function getCurrentUser(): Promise<UserState | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, telegram_id, language, phone_number, phone_verified, lifecycle_state, onboarding_step, verification_status, profile_completion, quiz_completion, security_intro_seen",
    )
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data as UserState;
}

export async function requireUser(locale: string): Promise<UserState> {
  if (isMaintenanceMode()) redirect(`/${locale}/maintenance`);

  const u = await getCurrentUser();
  if (!u) redirect(`/${locale}/onboarding/welcome`);

  // Fire-and-forget last_active_at bump. Failures (column missing, network)
  // must never block page render. Skipped if recently updated to avoid
  // hammering DB on rapid navigation.
  void bumpLastActive(u.id);

  return u;
}

const lastBumpCache = new Map<string, number>();
const BUMP_COOLDOWN_MS = 60 * 1000;

async function bumpLastActive(userId: string): Promise<void> {
  const now = Date.now();
  const last = lastBumpCache.get(userId);
  if (last && now - last < BUMP_COOLDOWN_MS) return;
  lastBumpCache.set(userId, now);
  try {
    await supabaseAdmin
      .from("users")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    // column may not exist yet (migration not applied) — silently skip
  }
}

/**
 * Use at the top of every onboarding page. Redirects user to where they
 * should be if they jumped ahead or fell behind. Returns the user only when
 * the current path matches their state.
 *
 * Pass `expectedStep` for onboarding pages, or omit to also accept active /
 * blocked states (e.g. `/main`, `/blocked` pages can call this without a
 * step).
 */
export async function requireUserAtStep(
  locale: string,
  expectedStep: OnboardingStep,
): Promise<UserState> {
  const u = await requireUser(locale);
  if (u.lifecycle_state === "blocked") redirect(`/${locale}/blocked`);
  if (u.lifecycle_state === "active") redirect(`/${locale}/main`);
  if (u.onboarding_step !== expectedStep) {
    redirect(`/${locale}${nextScreenFor(u)}`);
  }
  return u;
}
