import type { UserState, OnboardingStep } from "./types";

export const ONBOARDING_PATHS: Record<OnboardingStep, string> = {
  language: "/onboarding/language",
  security_intro: "/onboarding/security",
  phone_input: "/onboarding/phone",
  otp_pending: "/onboarding/otp",
  verification_intro: "/onboarding/verification-intro",
  document_upload: "/onboarding/document",
  liveness_upload: "/onboarding/liveness",
  moderation_submitted: "/onboarding/moderation/submitted",
  moderation_pending: "/onboarding/moderation/pending",
  verification_rejected: "/onboarding/moderation/rejected",
  profile_basic: "/onboarding/profile/basic",
  profile_photos: "/onboarding/profile/photos",
  profile_education: "/onboarding/profile/education",
  profile_family: "/onboarding/profile/family",
  profile_values: "/onboarding/profile/values",
  profile_looking_for: "/onboarding/profile/looking-for",
  profile_about: "/onboarding/profile/about",
  profile_preview: "/onboarding/profile/preview",
  quiz_intro: "/onboarding/quiz/intro",
  quiz_in_progress: "/onboarding/quiz/q",
  quiz_result: "/onboarding/quiz/result",
  complete: "/main",
};

/**
 * Returns the path the user should be on right now, given their server state.
 * Locale prefix is added by caller.
 */
export function nextScreenFor(user: UserState): string {
  if (user.lifecycle_state === "blocked") return "/blocked";
  if (user.lifecycle_state === "deleted") return "/blocked"; // soft-deleted accounts get same UX
  if (user.lifecycle_state === "active") return "/main";
  if (user.lifecycle_state === "paused") return "/main"; // paused-mode handled inside /main
  return ONBOARDING_PATHS[user.onboarding_step];
}

/**
 * Whether the requested path is allowed for the user's current state.
 * Used by proxy.ts to redirect users who try to skip ahead.
 */
export function isPathAllowed(user: UserState, pathname: string): boolean {
  const expected = nextScreenFor(user);
  // strip locale prefix
  const stripped = pathname.replace(/^\/(ru|uz)/, "") || "/";
  return stripped === expected || stripped.startsWith(expected);
}
