/**
 * Tests for /api/admin/export — admin gate + CSV format
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockState = {
  isAdmin: true,
  rows: [
    {
      id: "u-1",
      telegram_id: 123,
      telegram_username: "user_one",
      telegram_first_name: "Анора",
      phone_number: "+998901234567",
      language: "ru",
      lifecycle_state: "active",
      verification_status: "approved",
      profile_completion: "completed",
      quiz_completion: "completed",
      created_at: "2026-05-01T00:00:00Z",
      last_active_at: "2026-05-08T12:00:00Z",
      blocked_at: null,
      blocked_reason: null,
    },
    {
      id: "u-2",
      telegram_id: 456,
      telegram_username: null,
      telegram_first_name: 'Test "Quoted"',
      phone_number: "+998909999999",
      language: "uz",
      lifecycle_state: "blocked",
      verification_status: "revoked",
      profile_completion: "not_started",
      quiz_completion: "not_started",
      created_at: "2026-05-02T00:00:00Z",
      last_active_at: null,
      blocked_at: "2026-05-03T00:00:00Z",
      blocked_reason: "violation, suspicious activity",
    },
  ],
};

vi.mock("@/lib/admin/guard", () => ({
  isAdmin: () => Promise.resolve(mockState.isAdmin),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: mockState.rows, error: null }),
      }),
    }),
  },
}));

const { GET } = await import("./route");

describe("/api/admin/export", () => {
  beforeEach(() => {
    mockState.isAdmin = true;
  });

  it("returns 403 when not admin", async () => {
    mockState.isAdmin = false;
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns CSV with text/csv content-type", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(
      /attachment; filename="bakhtlilar-users-\d{4}-\d{2}-\d{2}\.csv"/,
    );
  });

  it("first line is the header row", async () => {
    const res = await GET();
    const text = await res.text();
    const firstLine = text.split("\n")[0];
    expect(firstLine).toContain("id");
    expect(firstLine).toContain("telegram_id");
    expect(firstLine).toContain("blocked_reason");
  });

  it("escapes commas and quotes", async () => {
    const res = await GET();
    const text = await res.text();
    // The "Test \"Quoted\"" name should be properly escaped
    expect(text).toContain('"Test ""Quoted"""');
    // The "violation, suspicious activity" reason has a comma → must be quoted
    expect(text).toContain('"violation, suspicious activity"');
  });

  it("renders null values as empty strings", async () => {
    const res = await GET();
    const text = await res.text();
    const lines = text.split("\n");
    // u-1 row has telegram_username = "user_one" (no comma needed)
    // u-2 row has null username → should appear as empty between commas
    expect(lines[2]).toMatch(/u-2,456,,/);
  });

  it("includes all rows from the query", async () => {
    const res = await GET();
    const text = await res.text();
    const lines = text.split("\n");
    // header + 2 data rows
    expect(lines.length).toBe(3);
  });
});
