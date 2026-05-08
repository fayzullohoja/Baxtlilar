import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenBody, ScreenFooter, PrimaryButton } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function QuizResultPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("quiz");
  const user = await requireUser(locale);
  const { data: result } = await supabaseAdmin
    .from("quiz_results")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  async function done() {
    "use server";
    await transition(
      user.id,
      { lifecycle_state: "active", onboarding_step: "complete" },
      "onboarding complete",
    );
    redirect(`/${locale}/main`);
  }

  return (
    <Screen>
      <ScreenBody>
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
            style={{
              backgroundColor: "var(--color-blush)",
              color: "var(--color-brand-deep)",
            }}
            aria-hidden
          >
            🌿
          </div>
          <h1 className="mt-6 text-[26px] font-semibold leading-tight tracking-tight text-[--color-plum]">
            {t("result_title")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[--color-ink-2]">
            Ваш профиль готов к мягкому подбору совместимости.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <Row label={t("result_intention")} value={result?.intention_type ?? "—"} />
          <Row label={t("result_tempo")} value={result?.relationship_tempo ?? "—"} />
          <Row label={t("result_style")} value={result?.communication_style ?? "—"} />
          <Row
            label={t("result_values")}
            value={`${result?.family_values_score ?? 0} / 4`}
          />
          <Row label="Стиль конфликтов" value={result?.conflict_style ?? "—"} />
          <Row label="Приоритет matching" value={String(result?.match_priority_score ?? 0)} />
        </div>
      </ScreenBody>
      <ScreenFooter>
        <form action={done}>
          <PrimaryButton type="submit">{t("result_continue")}</PrimaryButton>
        </form>
      </ScreenFooter>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-3.5 shadow-[0_4px_16px_rgba(74,44,53,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted]">
        {label}
      </p>
      <p className="text-[15px] font-semibold text-[--color-plum]">
        {String(value)}
      </p>
    </div>
  );
}
