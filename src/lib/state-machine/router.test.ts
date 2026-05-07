import { describe, it, expect } from "vitest";
import { nextScreenFor, isPathAllowed, ONBOARDING_PATHS } from "./router";
import type { UserState } from "./types";

const baseUser = (over: Partial<UserState> = {}): UserState => ({
  id: "u",
  telegram_id: 1,
  language: "ru",
  phone_number: "+998900000000",
  phone_verified: true,
  lifecycle_state: "onboarding",
  onboarding_step: "language",
  verification_status: "not_started",
  profile_completion: "not_started",
  quiz_completion: "not_started",
  security_intro_seen: false,
  ...over,
});

describe("nextScreenFor", () => {
  it("active user → /main", () => {
    expect(nextScreenFor(baseUser({ lifecycle_state: "active" }))).toBe("/main");
  });
  it("paused user → /main (mode handled inside)", () => {
    expect(nextScreenFor(baseUser({ lifecycle_state: "paused" }))).toBe("/main");
  });
  it("blocked user → /blocked", () => {
    expect(nextScreenFor(baseUser({ lifecycle_state: "blocked" }))).toBe("/blocked");
  });
  it("onboarding → maps step to path", () => {
    for (const [step, path] of Object.entries(ONBOARDING_PATHS)) {
      expect(
        nextScreenFor(
          baseUser({ onboarding_step: step as keyof typeof ONBOARDING_PATHS }),
        ),
      ).toBe(path);
    }
  });
});

describe("isPathAllowed", () => {
  it("allows the expected path", () => {
    const u = baseUser({ onboarding_step: "phone_input" });
    expect(isPathAllowed(u, "/ru/onboarding/phone")).toBe(true);
  });
  it("disallows skipping ahead", () => {
    const u = baseUser({ onboarding_step: "phone_input" });
    expect(isPathAllowed(u, "/ru/onboarding/quiz/intro")).toBe(false);
  });
  it("works for both locales", () => {
    const u = baseUser({ onboarding_step: "otp_pending" });
    expect(isPathAllowed(u, "/uz/onboarding/otp")).toBe(true);
    expect(isPathAllowed(u, "/ru/onboarding/otp")).toBe(true);
  });
});
