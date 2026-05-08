import { describe, it, expect, vi } from "vitest";

// Mock the supabaseAdmin lazy proxy so the test doesn't need real DB
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        limit: () => Promise.resolve({ error: null, data: [] }),
      }),
    }),
  },
}));

const { GET } = await import("./route");

describe("/api/health", () => {
  it("returns ok status with build info shape", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body).toHaveProperty("uptime_ms");
    expect(typeof body.uptime_ms).toBe("number");
    expect(body).toHaveProperty("checks");
    expect(body.checks.db.ok).toBe(true);
    expect(typeof body.checks.db.latency_ms).toBe("number");
    expect(body).toHaveProperty("env");
    expect(body).toHaveProperty("build");
    expect(body.build).toHaveProperty("commit");
    expect(body.build).toHaveProperty("branch");
    expect(body.build).toHaveProperty("deployment_id");
  });

  it("sets Cache-Control: no-store", async () => {
    const res = await GET();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("/api/health (DB error)", () => {
  it("returns 503 when DB ping fails", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/admin", () => ({
      supabaseAdmin: {
        from: () => ({
          select: () => ({
            limit: () =>
              Promise.resolve({
                error: { message: "connection refused" },
                data: null,
              }),
          }),
        }),
      },
    }));
    const { GET: brokenGet } = await import("./route");
    const res = await brokenGet();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("down");
    expect(body.checks.db.ok).toBe(false);
    expect(body.checks.db.error).toBe("connection refused");
  });
});
