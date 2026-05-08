/**
 * Unit tests for transition() with mocked supabase client. Verifies the
 * optimistic concurrency check + audit log construction.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockState {
  before: {
    lifecycle_state: string;
    onboarding_step: string;
    verification_status: string;
    profile_completion: string;
    quiz_completion: string;
    updated_at: string;
  };
  /** When non-null the .update().eq().eq().select().maybeSingle() returns this */
  updateResult: { id: string } | null;
  /** Captures every audit row insert */
  insertedAuditRows: Array<Record<string, unknown>>;
}

const mockState: MockState = {
  before: {
    lifecycle_state: "onboarding",
    onboarding_step: "language",
    verification_status: "not_started",
    profile_completion: "not_started",
    quiz_completion: "not_started",
    updated_at: "2026-01-01T00:00:00Z",
  },
  updateResult: { id: "u-1" },
  insertedAuditRows: [],
};

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({ data: mockState.before, error: null }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: mockState.updateResult,
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "user_state_transitions") {
        return {
          insert: (rows: Array<Record<string, unknown>>) => {
            mockState.insertedAuditRows.push(...rows);
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  },
}));

const { transition } = await import("./transitions");

describe("transition()", () => {
  beforeEach(() => {
    mockState.before = {
      lifecycle_state: "onboarding",
      onboarding_step: "language",
      verification_status: "not_started",
      profile_completion: "not_started",
      quiz_completion: "not_started",
      updated_at: "2026-01-01T00:00:00Z",
    };
    mockState.updateResult = { id: "u-1" };
    mockState.insertedAuditRows.length = 0;
  });

  it("happy path: writes patch + audit row", async () => {
    await transition(
      "u-1",
      { onboarding_step: "phone_input" },
      "test reason",
      "user",
    );

    expect(mockState.insertedAuditRows).toHaveLength(1);
    expect(mockState.insertedAuditRows[0]).toMatchObject({
      user_id: "u-1",
      field: "onboarding_step",
      old_value: "language",
      new_value: "phone_input",
      reason: "test reason",
      triggered_by: "user",
    });
  });

  it("writes one audit row per auditable field", async () => {
    await transition(
      "u-1",
      {
        onboarding_step: "phone_input",
        lifecycle_state: "onboarding",
      },
      "multi-field",
      "admin",
    );
    expect(mockState.insertedAuditRows).toHaveLength(2);
  });

  it("throws transition_conflict when update affects 0 rows (concurrent edit)", async () => {
    mockState.updateResult = null;
    await expect(
      transition("u-1", { onboarding_step: "phone_input" }, "race", "user"),
    ).rejects.toThrow(/transition_conflict/);
    // No audit rows since update didn't succeed
    expect(mockState.insertedAuditRows).toHaveLength(0);
  });

  it("doesn't write audit rows for non-auditable fields like phone_number", async () => {
    await transition(
      "u-1",
      { phone_number: "+998901234567" },
      "phone set",
      "user",
    );
    expect(mockState.insertedAuditRows).toHaveLength(0);
  });

  it("defaults triggered_by to 'user' when omitted", async () => {
    await transition("u-1", { onboarding_step: "phone_input" }, "no-trigger");
    expect(mockState.insertedAuditRows[0]?.triggered_by).toBe("user");
  });
});
