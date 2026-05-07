import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Screen, ScreenHeader, ScreenBody, ScreenFooter, PrimaryButton, SecondaryButton } from "@/components/ui/screen";
import { requireUser } from "@/lib/auth/current-user";
import { transition } from "@/lib/state-machine/transitions";
import { ONBOARDING_PATHS } from "@/lib/state-machine/router";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { QUIZ_QUESTIONS } from "@/lib/quiz/questions";
import { computeQuizResult } from "@/lib/quiz/scoring";
import { QuizQuestionForm } from "./client";

export default async function QuizQuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ n?: string }>;
}) {
  const { locale } = await params;
  const { n } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("quiz");
  const tc = await getTranslations("common");
  const user = await requireUser(locale);

  const idx = Math.max(0, Math.min(QUIZ_QUESTIONS.length - 1, Number(n ?? 0) || 0));
  const q = QUIZ_QUESTIONS[idx];

  const { data: existingAnswer } = await supabaseAdmin
    .from("quiz_answers")
    .select("answer")
    .eq("user_id", user.id)
    .eq("question_id", q.id)
    .maybeSingle();

  async function answer(formData: FormData) {
    "use server";
    const isMulti = !!q.multi;
    let value: string | string[];
    if (isMulti) {
      const all = formData.getAll("opt").map(String);
      const max = q.multi!.max;
      const min = q.multi!.min;
      if (all.length < min || all.length > max) {
        redirect(`/${locale}${ONBOARDING_PATHS.quiz_in_progress}?n=${idx}&error=range`);
      }
      value = all;
    } else {
      const single = formData.get("opt");
      if (!single) {
        redirect(`/${locale}${ONBOARDING_PATHS.quiz_in_progress}?n=${idx}&error=required`);
      }
      value = String(single);
    }

    await supabaseAdmin
      .from("quiz_answers")
      .upsert(
        { user_id: user.id, question_id: q.id, answer: value },
        { onConflict: "user_id,question_id" },
      );

    if (idx + 1 < QUIZ_QUESTIONS.length) {
      redirect(`/${locale}${ONBOARDING_PATHS.quiz_in_progress}?n=${idx + 1}`);
    }

    // last question — compute result
    const { data: rows } = await supabaseAdmin
      .from("quiz_answers")
      .select("question_id, answer")
      .eq("user_id", user.id);
    const map: Record<string, string | string[]> = {};
    for (const r of rows ?? []) map[r.question_id] = r.answer as string | string[];
    const result = computeQuizResult(map);
    await supabaseAdmin.from("quiz_results").upsert(
      {
        user_id: user.id,
        ...result,
      },
      { onConflict: "user_id" },
    );
    await transition(
      user.id,
      { onboarding_step: "quiz_result", quiz_completion: "completed" },
      "quiz completed",
    );
    redirect(`/${locale}${ONBOARDING_PATHS.quiz_result}`);
  }

  async function back() {
    "use server";
    if (idx > 0) {
      redirect(`/${locale}${ONBOARDING_PATHS.quiz_in_progress}?n=${idx - 1}`);
    }
    redirect(`/${locale}${ONBOARDING_PATHS.quiz_intro}`);
  }

  const prompt = locale === "uz" ? q.prompt_uz : q.prompt_ru;
  const opts = q.options.map((o) => ({
    id: o.id,
    label: locale === "uz" ? o.label_uz : o.label_ru,
  }));

  return (
    <Screen>
      <ScreenHeader
        title={prompt}
        subtitle={t("progress", { current: idx + 1, total: QUIZ_QUESTIONS.length })}
      />
      <ScreenBody>
        <QuizQuestionForm
          questionId={q.id}
          options={opts}
          multi={q.multi}
          submitAction={answer}
          backAction={back}
          existing={(existingAnswer?.answer ?? null) as string | string[] | null}
          labels={{ submit: tc("next"), back: tc("back") }}
        />
      </ScreenBody>
    </Screen>
  );
}
