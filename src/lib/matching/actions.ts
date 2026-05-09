"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/current-user";
import { notifyUserTelegram } from "@/lib/admin/notify";

const DAILY_LIMIT = 2;
const MIN_INTRO_LEN = 0;
const MAX_INTRO_LEN = 400;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function pair(a: string, b: string): { user_a_id: string; user_b_id: string } {
  return a < b ? { user_a_id: a, user_b_id: b } : { user_a_id: b, user_b_id: a };
}

function appUrl(locale: string, path: string): string {
  const base = (process.env.APP_URL ?? "https://baxtlilar.vercel.app").replace(/\/$/, "");
  return `${base}/${locale}${path}`;
}

async function getNotifyTarget(
  userId: string,
): Promise<{ telegram_id: number | null; display_name: string | null; locale: string }> {
  const { data: u } = await supabaseAdmin
    .from("users")
    .select("telegram_id, language")
    .eq("id", userId)
    .maybeSingle();
  const { data: p } = await supabaseAdmin
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    telegram_id: u?.telegram_id ? Number(u.telegram_id) : null,
    display_name: p?.display_name ?? null,
    locale: (u?.language as string) ?? "ru",
  };
}

/**
 * Send a match request. Enforces:
 *   - viewer is active+approved
 *   - target exists and is active+approved+discoverable
 *   - daily quota
 *   - no open (pending/accepted) request already
 */
export async function sendMatchRequest(formData: FormData): Promise<void> {
  const targetId = String(formData.get("target_id") ?? "");
  const intro = String(formData.get("intro") ?? "").trim().slice(0, MAX_INTRO_LEN);
  const locale = String(formData.get("locale") ?? "ru");

  const viewer = await requireUser(locale);
  if (!targetId || targetId === viewer.id) {
    redirect(`/${locale}/main?error=invalid`);
  }
  if (
    viewer.lifecycle_state !== "active" ||
    viewer.verification_status !== "approved"
  ) {
    redirect(`/${locale}/main?error=not_active`);
  }
  if (intro.length < MIN_INTRO_LEN) {
    redirect(`/${locale}/profile/${targetId}?error=intro_short`);
  }

  // target check
  const { data: tgt } = await supabaseAdmin
    .from("users")
    .select("id, lifecycle_state, verification_status")
    .eq("id", targetId)
    .maybeSingle();
  if (!tgt) redirect(`/${locale}/main?error=not_found`);
  if (tgt.lifecycle_state !== "active" || tgt.verification_status !== "approved") {
    redirect(`/${locale}/main?error=target_inactive`);
  }

  const { data: tProfile } = await supabaseAdmin
    .from("user_profiles")
    .select("is_discoverable, profile_paused")
    .eq("user_id", targetId)
    .maybeSingle();
  if (!tProfile?.is_discoverable || tProfile?.profile_paused) {
    redirect(`/${locale}/main?error=target_inactive`);
  }

  // existing open request check (either direction with status pending/accepted)
  const { data: existing } = await supabaseAdmin
    .from("match_requests")
    .select("id, sender_id, status")
    .or(
      `and(sender_id.eq.${viewer.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${viewer.id})`,
    )
    .in("status", ["pending", "accepted"]);
  if (existing && existing.length > 0) {
    // if THE OTHER side already sent us pending — auto-accept-flow goes via /requests, redirect there
    const fromOther = existing.find((r) => r.sender_id === targetId);
    if (fromOther) redirect(`/${locale}/requests?info=they_sent_first`);
    redirect(`/${locale}/profile/${targetId}?info=already_sent`);
  }

  // daily quota
  const day = todayUTC();
  const { data: q } = await supabaseAdmin
    .from("daily_request_quotas")
    .select("sent_count")
    .eq("user_id", viewer.id)
    .eq("quota_date", day)
    .maybeSingle();
  const sent = q?.sent_count ?? 0;
  if (sent >= DAILY_LIMIT) {
    redirect(`/${locale}/main?error=quota`);
  }

  // insert request
  const { error: insErr } = await supabaseAdmin.from("match_requests").insert({
    sender_id: viewer.id,
    receiver_id: targetId,
    intro_message: intro || null,
  });
  if (insErr) {
    redirect(`/${locale}/profile/${targetId}?error=insert_failed`);
  }

  // bump quota
  await supabaseAdmin
    .from("daily_request_quotas")
    .upsert(
      { user_id: viewer.id, quota_date: day, sent_count: sent + 1 },
      { onConflict: "user_id,quota_date" },
    );

  revalidatePath(`/${locale}/main`);
  revalidatePath(`/${locale}/requests`);
  redirect(`/${locale}/requests?tab=outgoing&info=sent`);
}

/** Receiver accepts. Creates a chat row if not yet present. */
export async function acceptMatchRequest(formData: FormData): Promise<void> {
  const requestId = String(formData.get("request_id") ?? "");
  const locale = String(formData.get("locale") ?? "ru");
  const viewer = await requireUser(locale);

  const { data: req } = await supabaseAdmin
    .from("match_requests")
    .select("id, sender_id, receiver_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.receiver_id !== viewer.id || req.status !== "pending") {
    redirect(`/${locale}/requests?error=invalid`);
  }

  const { data: updated } = await supabaseAdmin
    .from("match_requests")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending") // optimistic lock
    .select("id")
    .maybeSingle();
  if (!updated) redirect(`/${locale}/requests?error=raced`);

  const p = pair(req.sender_id, req.receiver_id);
  // upsert chat
  const { data: chat } = await supabaseAdmin
    .from("chats")
    .upsert(
      { ...p, created_from_match_id: req.id },
      { onConflict: "user_a_id,user_b_id", ignoreDuplicates: false },
    )
    .select("id")
    .maybeSingle();

  // notify the original sender that their request was accepted
  const [sender, acceptor] = await Promise.all([
    getNotifyTarget(req.sender_id),
    getNotifyTarget(viewer.id),
  ]);
  if (sender.telegram_id) {
    const who = acceptor.display_name ?? "Кто-то";
    const link = chat?.id
      ? appUrl(sender.locale, `/chats/${chat.id}`)
      : appUrl(sender.locale, "/chats");
    void notifyUserTelegram(
      sender.telegram_id,
      `💌 <b>${who} приняла ваш запрос на знакомство!</b>\n\n<a href="${link}">Открыть чат →</a>`,
    );
  }

  revalidatePath(`/${locale}/requests`);
  revalidatePath(`/${locale}/chats`);
  if (chat?.id) redirect(`/${locale}/chats/${chat.id}`);
  redirect(`/${locale}/chats`);
}

export async function declineMatchRequest(formData: FormData): Promise<void> {
  const requestId = String(formData.get("request_id") ?? "");
  const reason = String(formData.get("reason") ?? "").slice(0, 200);
  const locale = String(formData.get("locale") ?? "ru");
  const viewer = await requireUser(locale);

  await supabaseAdmin
    .from("match_requests")
    .update({
      status: "declined",
      decline_reason: reason || null,
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("receiver_id", viewer.id)
    .eq("status", "pending");

  revalidatePath(`/${locale}/requests`);
  redirect(`/${locale}/requests?info=declined`);
}

export async function withdrawMatchRequest(formData: FormData): Promise<void> {
  const requestId = String(formData.get("request_id") ?? "");
  const locale = String(formData.get("locale") ?? "ru");
  const viewer = await requireUser(locale);

  await supabaseAdmin
    .from("match_requests")
    .update({
      status: "withdrawn",
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("sender_id", viewer.id)
    .eq("status", "pending");

  revalidatePath(`/${locale}/requests`);
  redirect(`/${locale}/requests?tab=outgoing&info=withdrawn`);
}

export async function sendChatMessage(formData: FormData): Promise<void> {
  const chatId = String(formData.get("chat_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const locale = String(formData.get("locale") ?? "ru");
  const viewer = await requireUser(locale);
  if (!body) redirect(`/${locale}/chats/${chatId}?error=empty`);
  if (body.length > 4000) redirect(`/${locale}/chats/${chatId}?error=too_long`);

  // membership check
  const { data: chat } = await supabaseAdmin
    .from("chats")
    .select("id, user_a_id, user_b_id")
    .eq("id", chatId)
    .maybeSingle();
  if (!chat) redirect(`/${locale}/chats?error=not_found`);
  if (chat.user_a_id !== viewer.id && chat.user_b_id !== viewer.id) {
    redirect(`/${locale}/chats?error=not_member`);
  }

  await supabaseAdmin.from("chat_messages").insert({
    chat_id: chatId,
    sender_id: viewer.id,
    body,
  });

  // Notify recipient — but only on the "first unread" to avoid spamming a back-and-forth.
  // If recipient already has unread messages from us in this chat, they were already pinged.
  const recipientId = chat.user_a_id === viewer.id ? chat.user_b_id : chat.user_a_id;
  const { count: unreadFromMe } = await supabaseAdmin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", chatId)
    .eq("sender_id", viewer.id)
    .is("read_at", null);
  if ((unreadFromMe ?? 0) <= 1) {
    const [recipient, sender] = await Promise.all([
      getNotifyTarget(recipientId),
      getNotifyTarget(viewer.id),
    ]);
    if (recipient.telegram_id) {
      const who = sender.display_name ?? "Кто-то";
      const preview = body.length > 80 ? body.slice(0, 80) + "…" : body;
      const escaped = preview
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const link = appUrl(recipient.locale, `/chats/${chatId}`);
      void notifyUserTelegram(
        recipient.telegram_id,
        `💬 <b>${who}:</b> ${escaped}\n\n<a href="${link}">Ответить →</a>`,
      );
    }
  }

  revalidatePath(`/${locale}/chats/${chatId}`);
  redirect(`/${locale}/chats/${chatId}`);
}

/** "Saw this person in feed" — used by /main to dedup. */
export async function markFeedSeen(formData: FormData): Promise<void> {
  const idsJson = String(formData.get("target_ids") ?? "[]");
  const locale = String(formData.get("locale") ?? "ru");
  const viewer = await requireUser(locale);
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(idsJson);
    if (Array.isArray(parsed)) ids = parsed.filter((x) => typeof x === "string");
  } catch {
    return;
  }
  if (ids.length === 0) return;
  await supabaseAdmin
    .from("match_views")
    .upsert(
      ids.map((id) => ({ viewer_id: viewer.id, target_id: id })),
      { onConflict: "viewer_id,target_id" },
    );
  revalidatePath(`/${locale}/main`);
}
