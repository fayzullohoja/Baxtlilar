import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function ModerationListPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const { data: pending } = await supabaseAdmin
    .from("users")
    .select(
      "id, telegram_id, telegram_username, telegram_first_name, phone_number, verification_status, onboarding_step, created_at",
    )
    .eq("verification_status", "pending_review")
    .order("created_at", { ascending: true });

  const { data: stats } = await supabaseAdmin
    .from("users")
    .select("verification_status");

  const counts = (stats ?? []).reduce<Record<string, number>>((acc, u) => {
    acc[u.verification_status] = (acc[u.verification_status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Модерация</h1>
          <p className="text-sm text-neutral-600">
            В очереди: {pending?.length ?? 0} · approved: {counts.approved ?? 0} · rejected: {counts.rejected ?? 0}
          </p>
        </div>
        <Link href="/admin/login?logout=1" className="text-sm text-neutral-500 underline">
          выйти
        </Link>
      </header>

      {!pending?.length ? (
        <p className="rounded-xl border border-neutral-200 bg-white p-6 text-center text-neutral-500">
          Очередь пуста
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.map((u) => (
            <li key={u.id}>
              <Link
                href={`/admin/moderation/${u.id}`}
                className="block rounded-xl border border-neutral-200 bg-white p-4 hover:border-neutral-900"
              >
                <div className="flex items-baseline justify-between">
                  <p className="font-medium">
                    {u.telegram_first_name ?? "—"}
                    {u.telegram_username ? ` @${u.telegram_username}` : ""}
                  </p>
                  <span className="text-xs text-neutral-500">
                    {new Date(u.created_at).toLocaleString("ru-RU")}
                  </span>
                </div>
                <p className="text-sm text-neutral-600">
                  TG ID: {u.telegram_id} · {u.phone_number ?? "no phone"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
