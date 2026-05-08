import { describe, it, expect } from "vitest";
import {
  VERIFICATION_LABELS,
  LIFECYCLE_LABELS,
  TRIGGER_COLORS,
  FIELD_LABELS,
} from "./labels";

describe("admin labels", () => {
  it("has every verification_status enum value covered", () => {
    const expected = [
      "not_started",
      "phone_verified",
      "documents_uploaded",
      "liveness_uploaded",
      "pending_review",
      "approved",
      "rejected",
      "revoked",
    ];
    for (const k of expected) {
      expect(VERIFICATION_LABELS[k]).toBeDefined();
      expect(VERIFICATION_LABELS[k].label).toBeTruthy();
      expect(VERIFICATION_LABELS[k].tone).toBeDefined();
    }
  });

  it("has every lifecycle_state enum value covered", () => {
    const expected = ["onboarding", "active", "paused", "blocked", "deleted"];
    for (const k of expected) {
      expect(LIFECYCLE_LABELS[k]).toBeDefined();
      expect(LIFECYCLE_LABELS[k].label).toBeTruthy();
    }
  });

  it("trigger colors map covers user/admin/system", () => {
    expect(TRIGGER_COLORS.user).toMatch(/var\(/);
    expect(TRIGGER_COLORS.admin).toMatch(/var\(/);
    expect(TRIGGER_COLORS.system).toMatch(/var\(/);
  });

  it("field labels map shortens DB names to UI labels", () => {
    expect(FIELD_LABELS.lifecycle_state).toBe("lifecycle");
    expect(FIELD_LABELS.verification_status).toBe("verification");
    expect(FIELD_LABELS.onboarding_step).toBe("onboarding");
  });
});
