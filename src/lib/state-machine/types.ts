export type LifecycleState =
  | "onboarding"
  | "active"
  | "paused"
  | "blocked"
  | "deleted";

export type OnboardingStep =
  | "language"
  | "security_intro"
  | "phone_input"
  | "otp_pending"
  | "verification_intro"
  | "document_upload"
  | "liveness_upload"
  | "moderation_submitted"
  | "moderation_pending"
  | "verification_rejected"
  | "profile_basic"
  | "profile_photos"
  | "profile_education"
  | "profile_family"
  | "profile_values"
  | "profile_looking_for"
  | "profile_about"
  | "profile_preview"
  | "quiz_intro"
  | "quiz_in_progress"
  | "quiz_result"
  | "complete";

export type VerificationStatus =
  | "not_started"
  | "phone_verified"
  | "documents_uploaded"
  | "liveness_uploaded"
  | "pending_review"
  | "approved"
  | "rejected"
  | "revoked";

export type ProfileCompletion =
  | "not_started"
  | "in_progress"
  | "completed"
  | "pending_remoderation";

export type QuizCompletion = "not_started" | "in_progress" | "completed";

export type UserLanguage = "ru" | "uz";
export type Gender = "male" | "female";
export type MaritalStatus = "never_married" | "divorced" | "widowed";

export interface UserState {
  id: string;
  telegram_id: number;
  language: UserLanguage | null;
  phone_number: string | null;
  phone_verified: boolean;
  lifecycle_state: LifecycleState;
  onboarding_step: OnboardingStep;
  verification_status: VerificationStatus;
  profile_completion: ProfileCompletion;
  quiz_completion: QuizCompletion;
  security_intro_seen: boolean;
}
