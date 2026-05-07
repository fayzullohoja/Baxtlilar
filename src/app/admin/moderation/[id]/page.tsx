import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { transition } from "@/lib/state-machine/transitions";

async function signedDoc(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage
    .from("documents")
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export default async function ModerationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!user) redirect("/admin/moderation");

  const { data: doc } = await supabaseAdmin
    .from("user_documents")
    .select("passport_path, passport_uploaded_at, selfie_path, selfie_uploaded_at, submitted_at, rejection_reason")
    .eq("user_id", id)
    .maybeSingle();

  const passportUrl = await signedDoc(doc?.passport_path);
  const selfieUrl = await signedDoc(doc?.selfie_path);

  async function approve() {
    "use server";
    await supabaseAdmin
      .from("user_documents")
      .update({
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
        rejection_kind: null,
      })
      .eq("user_id", id);
    await transition(
      id,
      {
        verification_status: "approved",
        onboarding_step: "profile_basic",
        profile_completion: "in_progress",
      },
      "moderator approved",
      "admin",
    );
    redirect("/admin/moderation");
  }

  async function reject(formData: FormData) {
    "use server";
    const reason = String(formData.get("reason") ?? "Документы не приняты").trim();
    const kind = String(formData.get("kind") ?? "passport");
    await supabaseAdmin
      .from("user_documents")
      .update({
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
        rejection_kind: kind,
      })
      .eq("user_id", id);
    await transition(
      id,
      {
        verification_status: "rejected",
        onboarding_step: "verification_rejected",
      },
      `moderator rejected: ${reason}`,
      "admin",
    );
    redirect("/admin/moderation");
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/admin/moderation" className="text-sm text-neutral-500 underline">
          ← к очереди
        </Link>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
          {user.verification_status}
        </span>
      </header>

      <h1 className="text-2xl font-semibold">
        {user.telegram_first_name ?? "—"}
        {user.telegram_username ? ` @${user.telegram_username}` : ""}
      </h1>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Info label="TG ID" value={String(user.telegram_id)} />
        <Info label="Телефон" value={user.phone_number ?? "—"} />
        <Info label="Язык" value={user.language ?? "—"} />
        <Info
          label="Подал"
          value={doc?.submitted_at ? new Date(doc.submitted_at).toLocaleString("ru-RU") : "—"}
        />
      </dl>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Photo title="Паспорт" url={passportUrl} />
        <Photo title="Selfie" url={selfieUrl} />
      </section>

      <section className="mt-6 flex flex-col gap-3">
        <form action={approve}>
          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-green-600 font-medium text-white"
          >
            Одобрить
          </button>
        </form>

        <form action={reject} className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
          <label className="text-sm font-medium text-red-900">Отклонить</label>
          <select name="kind" className="h-10 rounded-lg border border-red-300 bg-white px-3 text-sm">
            <option value="passport">Переснять паспорт</option>
            <option value="selfie">Переснять selfie</option>
            <option value="both">Переснять оба</option>
          </select>
          <textarea
            name="reason"
            placeholder="Причина (фото размыто, данные не читаются и т.п.)"
            className="min-h-20 rounded-lg border border-red-300 bg-white p-3 text-sm"
            required
          />
          <button
            type="submit"
            className="h-12 rounded-xl bg-red-600 font-medium text-white"
          >
            Отклонить
          </button>
        </form>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 font-mono text-sm">{value}</dd>
    </div>
  );
}

function Photo({ title, url }: { title: string; url: string | null }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <p className="border-b border-neutral-200 px-4 py-2 text-sm font-medium">{title}</p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} className="block w-full" />
      ) : (
        <p className="p-8 text-center text-sm text-neutral-400">нет файла</p>
      )}
    </div>
  );
}
