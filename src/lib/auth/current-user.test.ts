/**
 * Tests for requireUserAtStep redirect logic. Mocks supabase client and
 * next/navigation so we can verify the right redirects fire for each
 * lifecycle/step combination.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Track redirect calls — Next.js redirect() throws a special error
const redirectCalls: string[] = [];

// Mutable mock-state container shared with the supabase mock factory below
const mockState = {
  user: {
    id: "u-123",
    telegram_id: 555,
    language: "ru" as const,
    phone_number: null,
    phone_verified: false,
    lifecycle_state: "onboarding" as string,
    onboarding_step: "phone_input" as string,
    verification_status: "not_started" as string,
    profile_completion: "not_started" as string,
    quiz_completion: "not_started" as string,
    security_intro_seen: false,
  },
};

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    redirectCalls.push(path);
    throw new Error(`__REDIRECT__ ${path}`);
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            mockState.user
              ? Promise.resolve({ data: mockState.user, error: null })
              : Promise.resolve({ data: null, error: { message: "not found" } }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  },
}));

vi.mock("./session", () => ({
  getSessionUserId: () => Promise.resolve("u-123"),
}));

vi.mock("@/lib/maintenance", () => ({
  isMaintenanceMode: () => false,
}));

const { requireUserAtStep } = await import("./current-user");

describe("requireUserAtStep", () => {
  beforeEach(() => {
    redirectCalls.length = 0;
    // Reset to baseline user
    mockState.user = {
      ...mockState.user,
      lifecycle_state: "onboarding",
      onboarding_step: "phone_input",
    };
  });

  it("returns the user when at the expected step", async () => {
    const u = await requireUserAtStep("ru", "phone_input");
    expect(u.id).toBe("u-123");
    expect(redirectCalls).toEqual([]);
  });

  it("redirects to nextScreenFor when step doesn't match", async () => {
    mockState.user = { ...mockState.user, onboarding_step: "language" };
    await expect(requireUserAtStep("ru", "phone_input")).rejects.toThrow(
      "__REDIRECT__",
    );
    expect(redirectCalls[0]).toBe("/ru/onboarding/language");
  });

  it("redirects blocked user to /blocked regardless of step", async () => {
    mockState.user = { ...mockState.user, lifecycle_state: "blocked" };
    await expect(requireUserAtStep("ru", "phone_input")).rejects.toThrow(
      "__REDIRECT__",
    );
    expect(redirectCalls[0]).toBe("/ru/blocked");
  });

  it("redirects active user to /main", async () => {
    mockState.user = { ...mockState.user, lifecycle_state: "active" };
    await expect(requireUserAtStep("ru", "phone_input")).rejects.toThrow(
      "__REDIRECT__",
    );
    expect(redirectCalls[0]).toBe("/ru/main");
  });
});
