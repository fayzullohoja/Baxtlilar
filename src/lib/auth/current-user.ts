import "server-only";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUserId } from "./session";
import type { UserState } from "@/lib/state-machine/types";

export async function getCurrentUser(): Promise<UserState | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, telegram_id, language, phone_number, phone_verified, lifecycle_state, onboarding_step, verification_status, profile_completion, quiz_completion, security_intro_seen",
    )
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data as UserState;
}

export async function requireUser(locale: string): Promise<UserState> {
  const u = await getCurrentUser();
  if (!u) redirect(`/${locale}/onboarding/welcome`);
  return u;
}
