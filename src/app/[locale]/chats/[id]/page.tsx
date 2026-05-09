import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Screen, ScreenBody } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSignedPhotoUrl } from "@/lib/uploads/photos";
import { sendChatMessage } from "@/lib/matching/actions";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  if (user.lifecycle_state !== "active" && user.lifecycle_state !== "paused") {
    redirect(`/${locale}/main`);
  }

  const { data: chat } = await supabaseAdmin
    .from("chats")
    .select("id, user_a_id, user_b_id, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!chat) notFound();
  if (chat.user_a_id !== user.id && chat.user_b_id !== user.id) notFound();

  const otherId = chat.user_a_id === user.id ? chat.user_b_id : chat.user_a_id;

  const [{ data: otherProfile }, { data: otherPhoto }, { data: messages }] =
    await Promise.all([
      supabaseAdmin
        .from("user_profiles")
        .select("display_name")
        .eq("user_id", otherId)
        .maybeSingle(),
      supabaseAdmin
        .from("profile_photos")
        .select("storage_path")
        .eq("user_id", otherId)
        .eq("is_main", true)
        .maybeSingle(),
      supabaseAdmin
        .from("chat_messages")
        .select("id, sender_id, body, created_at")
        .eq("chat_id", id)
        .order("created_at", { ascending: true })
        .limit(200),
    ]);

  // mark incoming as read
  await supabaseAdmin
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("chat_id", id)
    .neq("sender_id", user.id)
    .is("read_at", null);

  const otherPhotoUrl = otherPhoto
    ? await getSignedPhotoUrl(otherPhoto.storage_path)
    : null;
  const otherName = otherProfile?.display_name ?? "—";

  return (
    <Screen>
      <ScreenBody className="pb-32">
        <header className="mt-1 flex items-center gap-3">
          <Link
            href={`/${locale}/chats`}
            className="text-xl text-[--color-plum-mute]"
            aria-label="Назад"
          >
            ←
          </Link>
          <Link
            href={`/${locale}/profile/${otherId}`}
            className="flex flex-1 items-center gap-3"
          >
            {otherPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={otherPhotoUrl}
                alt={otherName}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold"
                style={{
                  backgroundColor: "var(--color-blush)",
                  color: "var(--color-brand-deep)",
                }}
              >
                {otherName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <p className="text-base font-semibold text-[--color-plum]">{otherName}</p>
          </Link>
        </header>

        <div className="mt-4 flex flex-col gap-2">
          {(messages ?? []).length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-[--color-ink-2]">
              Пока нет сообщений. Поздоровайтесь первыми.
            </div>
          ) : (
            (messages ?? []).map((m) => (
              <Bubble
                key={m.id}
                isMine={m.sender_id === user.id}
                body={m.body}
                createdAt={m.created_at}
              />
            ))
          )}
        </div>

        <div
          className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t bg-white px-3 py-2"
          style={{ borderColor: "var(--color-line)" }}
        >
          <form action={sendChatMessage} className="flex items-end gap-2">
            <input type="hidden" name="chat_id" value={id} />
            <input type="hidden" name="locale" value={locale} />
            <textarea
              name="body"
              rows={1}
              maxLength={4000}
              required
              placeholder="Написать сообщение"
              className="flex-1 resize-none rounded-2xl border bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--color-line)" }}
            />
            <button
              type="submit"
              className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--color-brand-deep)" }}
            >
              ↑
            </button>
          </form>
        </div>
      </ScreenBody>
    </Screen>
  );
}

function Bubble({
  isMine,
  body,
  createdAt,
}: {
  isMine: boolean;
  body: string;
  createdAt: string;
}) {
  const time = new Date(createdAt).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[80%] rounded-2xl px-4 py-2 text-sm"
        style={{
          backgroundColor: isMine ? "var(--color-brand-deep)" : "var(--color-blush)",
          color: isMine ? "white" : "var(--color-ink-1)",
        }}
      >
        <p className="whitespace-pre-wrap">{body}</p>
        <p
          className="mt-0.5 text-right text-[10px] opacity-70"
          style={{ color: isMine ? "rgba(255,255,255,0.85)" : "var(--color-plum-mute)" }}
        >
          {time}
        </p>
      </div>
    </div>
  );
}
