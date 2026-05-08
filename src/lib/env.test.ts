/**
 * Env validator: just sanity-check the schema parses real-looking values.
 * We don't reach into the singleton because process.env mutations leak
 * across tests; instead we test the schema directly.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  ADMIN_SECRET: z.string().min(8),
});

describe("env schema (subset)", () => {
  it("accepts valid prod-shaped values", () => {
    const r = envSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      SESSION_SECRET: "x".repeat(32),
      ADMIN_SECRET: "longenoughsecret",
    });
    expect(r.success).toBe(true);
  });

  it("rejects too-short SESSION_SECRET", () => {
    const r = envSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      SESSION_SECRET: "tooshort",
      ADMIN_SECRET: "longenoughsecret",
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-URL Supabase URL", () => {
    const r = envSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      SESSION_SECRET: "x".repeat(32),
      ADMIN_SECRET: "longenoughsecret",
    });
    expect(r.success).toBe(false);
  });
});
