import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { setSessionCookie } from "./session";
import { validateInitData, devFakeInitData } from "@/lib/telegram/init-data";

/**
 * Creates or finds a user from Telegram initData and sets a session cookie.
 * In DEV_BYPASS_TG mode, accepts either a real initData or generates a fake one.
 * Returns the user_id.
 */
export async function bootstrapFromTelegram(initData?: string): Promise<string> {
  const data = initData
    ? validateInitData(initData)
    : process.env.DEV_BYPASS_TG === "1"
      ? validateInitData(devFakeInitData())
      : null;

  if (!data?.user) {
    throw new Error("Invalid Telegram initData");
  }

  const tgUser = data.user;
  // Upsert by telegram_id
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id, lifecycle_state")
    .eq("telegram_id", tgUser.id)
    .maybeSingle();

  let userId: string;
  if (existing) {
    userId = existing.id;
    // If user soft-deleted themselves earlier, revive them: reset back to
    // onboarding so they can start fresh. Their old data was wiped during
    // delete; this gives them a way back instead of being stuck on /blocked.
    const isReviving = existing.lifecycle_state === "deleted";
    await supabaseAdmin
      .from("users")
      .update({
        telegram_username: tgUser.username ?? null,
        telegram_first_name: tgUser.first_name ?? null,
        telegram_last_name: tgUser.last_name ?? null,
        ...(isReviving
          ? {
              lifecycle_state: "onboarding",
              onboarding_step: "language",
              verification_status: "not_started",
              profile_completion: "not_started",
              quiz_completion: "not_started",
              blocked_at: null,
              blocked_reason: null,
            }
          : {}),
      })
      .eq("id", userId);
  } else {
    const { data: created, error } = await supabaseAdmin
      .from("users")
      .insert({
        telegram_id: tgUser.id,
        telegram_username: tgUser.username ?? null,
        telegram_first_name: tgUser.first_name ?? null,
        telegram_last_name: tgUser.last_name ?? null,
      })
      .select("id")
      .single();
    if (error || !created) throw error ?? new Error("Failed to create user");
    userId = created.id;
  }

  await setSessionCookie(userId);
  return userId;
}
