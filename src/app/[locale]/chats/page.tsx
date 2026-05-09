import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Screen, ScreenBody } from "@/components/ui/screen";
import { BottomNav } from "@/components/bottom-nav";
import { requireUser } from "@/lib/auth/current-user";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSignedPhotoUrl } from "@/lib/uploads/photos";

export default async function ChatsListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  if (user.lifecycle_state !== "active" && user.lifecycle_state !== "paused") {
    redirect(`/${locale}/main`);
  }

  const { data: chats } = await supabaseAdmin
    .from("chats")
    .select("id, user_a_id, user_b_id, last_message_at, created_at")
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  const otherIds = (chats ?? []).map((c) =>
    c.user_a_id === user.id ? c.user_b_id : c.user_a_id,
  );
  const [{ data: profiles }, { data: photos }, { data: lastMessages }] =
    await Promise.all([
      otherIds.length > 0
        ? supabaseAdmin
            .from("user_profiles")
            .select("user_id, display_name")
            .in("user_id", otherIds)
        : Promise.resolve({ data: [] as Array<{ user_id: string; display_name: string | null }> }),
      otherIds.length > 0
        ? supabaseAdmin
            .from("profile_photos")
            .select("user_id, storage_path")
            .in("user_id", otherIds)
            .eq("is_main", true)
        : Promise.resolve({ data: [] as Array<{ user_id: string; storage_path: string }> }),
      (chats ?? []).length > 0
        ? supabaseAdmin
            .from("chat_messages")
            .select("chat_id, body, sender_id, created_at")
            .in("chat_id", (chats ?? []).map((c) => c.id))
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as Array<{ chat_id: string; body: string; sender_id: string; created_at: string }> }),
    ]);

  const profileMap = new Map<string, { name: string | null; photoUrl: string | null }>();
  for (const p of profiles ?? []) {
    profileMap.set(p.user_id, { name: p.display_name, photoUrl: null });
  }
  for (const ph of photos ?? []) {
    const url = await getSignedPhotoUrl(ph.storage_path);
    const e = profileMap.get(ph.user_id);
    if (e) e.photoUrl = url;
  }

  const lastByChat = new Map<string, { body: string; sender_id: string; created_at: string }>();
  for (const m of lastMessages ?? []) {
    if (!lastByChat.has(m.chat_id)) lastByChat.set(m.chat_id, m);
  }

  return (
    <Screen>
      <ScreenBody className="pb-24">
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[--color-plum]">
          Чаты
        </h1>

        <div className="mt-4 space-y-2">
          {(chats ?? []).length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center text-sm text-[--color-ink-2] shadow-[0_2px_8px_rgba(74,44,53,0.04)]">
              Чаты появятся, когда другой участник примет вашу заявку.
            </div>
          ) : (
            (chats ?? []).map((c) => {
              const otherId = c.user_a_id === user.id ? c.user_b_id : c.user_a_id;
              const p = profileMap.get(otherId);
              const last = lastByChat.get(c.id);
              return (
                <Link
                  key={c.id}
                  href={`/${locale}/chats/${c.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_2px_8px_rgba(74,44,53,0.04)] active:scale-[0.99]"
                >
                  {p?.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photoUrl}
                      alt={p.name ?? ""}
                      className="h-14 w-14 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold"
                      style={{
                        backgroundColor: "var(--color-blush)",
                        color: "var(--color-brand-deep)",
                      }}
                    >
                      {(p?.name ?? "—").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-[--color-plum]">
                      {p?.name ?? "—"}
                    </p>
                    <p className="truncate text-xs text-[--color-ink-2]">
                      {last
                        ? (last.sender_id === user.id ? "Вы: " : "") + last.body
                        : "Поздоровайтесь первыми"}
                    </p>
                  </div>
                  {last ? (
                    <span className="shrink-0 text-[10px] text-[--color-ink-muted]">
                      {formatTime(last.created_at)}
                    </span>
                  ) : null}
                </Link>
              );
            })
          )}
        </div>
      </ScreenBody>
      <BottomNav locale={locale} active="chats" />
    </Screen>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}
