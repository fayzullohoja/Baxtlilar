import "server-only";
import { z } from "zod";

/**
 * Validates required env vars at startup. Throws if anything critical is
 * missing — Vercel build fails fast, no half-configured deploys reach
 * production.
 *
 * Uses .safeParse() so we can log all missing vars at once instead of
 * the user having to re-run after each fix.
 */
const envSchema = z.object({
  // Core
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be ≥ 32 chars"),
  TELEGRAM_BOT_TOKEN: z.string().min(20),
  ADMIN_SECRET: z.string().min(8),

  // Toggles
  DEV_BYPASS_TG: z.enum(["0", "1"]).optional().default("0"),
  SMS_PROVIDER: z.string().optional().default("mock"),
  OTP_DISABLE_RATE_LIMIT: z.enum(["0", "1"]).optional(),

  // Optional
  ADMIN_TG_CHAT_ID: z.string().optional(),
  APP_URL: z.string().url().optional(),

  // Vercel-injected
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),
  VERCEL_GIT_COMMIT_REF: z.string().optional(),
  VERCEL_DEPLOYMENT_ID: z.string().optional(),
});

let _env: z.infer<typeof envSchema> | null = null;

export function env(): z.infer<typeof envSchema> {
  if (_env) return _env;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `[env] missing or invalid environment variables:\n${issues}\n\nSee .env.example for required vars.`,
    );
  }
  _env = parsed.data;
  return _env;
}

/**
 * In production we want loud failure. In development a missing env var
 * is also a problem but should be visible in dev server logs, not crash
 * the entire build. Call this from places that explicitly need validated
 * env (most server actions just read process.env directly).
 */
