/**
 * Single source of truth for admin badge labels + tones across pages.
 * Used by /admin/moderation, /admin/users, /admin/banned, /admin/audit.
 */

type Tone = "default" | "warn" | "success" | "danger" | "info";

export const VERIFICATION_LABELS: Record<string, { label: string; tone: Tone }> = {
  not_started: { label: "—", tone: "default" },
  phone_verified: { label: "Телефон", tone: "info" },
  documents_uploaded: { label: "Паспорт", tone: "info" },
  liveness_uploaded: { label: "Selfie", tone: "info" },
  pending_review: { label: "На проверку", tone: "warn" },
  approved: { label: "Одобрен", tone: "success" },
  rejected: { label: "Отклонён", tone: "danger" },
  revoked: { label: "Отозван", tone: "danger" },
};

export const LIFECYCLE_LABELS: Record<string, { label: string; tone: Tone }> = {
  onboarding: { label: "Онбординг", tone: "info" },
  active: { label: "Активный", tone: "success" },
  paused: { label: "Пауза", tone: "warn" },
  blocked: { label: "Заблокирован", tone: "danger" },
  deleted: { label: "Удалён", tone: "default" },
};

export const TRIGGER_COLORS: Record<string, string> = {
  user: "var(--admin-info)",
  admin: "var(--admin-accent-deep)",
  system: "var(--admin-text-muted)",
};

export const FIELD_LABELS: Record<string, string> = {
  lifecycle_state: "lifecycle",
  onboarding_step: "onboarding",
  verification_status: "verification",
  profile_completion: "profile",
  quiz_completion: "quiz",
};
