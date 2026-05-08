"use client";

import { useState, useTransition } from "react";

const STEP_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  {
    value: "language",
    label: "Самое начало",
    description: "Сбросить полностью — пройдёт всё заново",
  },
  {
    value: "phone_input",
    label: "Ввод телефона",
    description: "Перейдёт на ввод номера и OTP",
  },
  {
    value: "document_upload",
    label: "Загрузка паспорта",
    description: "Юзер сможет переснять документы",
  },
  {
    value: "profile_basic",
    label: "Анкета (базовая)",
    description: "Юзер заполнит профиль с нуля",
  },
  {
    value: "profile_photos",
    label: "Фото профиля",
    description: "Будет загружать фото",
  },
  {
    value: "profile_education",
    label: "Образование/работа",
    description: "Продолжит с раздела о работе",
  },
  {
    value: "quiz_intro",
    label: "Вступление к квизу",
    description: "Перейдёт к квизу, профиль сохранится",
  },
];

export function ResetForm({
  resetAction,
}: {
  resetAction: (fd: FormData) => Promise<void>;
}) {
  const [step, setStep] = useState(STEP_OPTIONS[3].value);
  const [wipeProfile, setWipeProfile] = useState(false);
  const [wipeQuiz, setWipeQuiz] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    if (
      !confirm(
        `Сбросить юзера на «${STEP_OPTIONS.find((s) => s.value === step)?.label}»? Действие в audit log.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await resetAction(formData);
    });
  }

  const selected = STEP_OPTIONS.find((s) => s.value === step);

  return (
    <form
      action={submit}
      className="flex flex-col gap-3 border-t border-[--admin-border] bg-[--admin-surface-2] px-4 py-4"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[--admin-text-muted]">
          На какой шаг сбросить
        </span>
        <select
          name="step"
          value={step}
          onChange={(e) => setStep(e.target.value)}
          className="h-9 rounded-md border border-[--admin-border] bg-white px-2.5 text-sm text-[--admin-text]"
        >
          {STEP_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {selected ? (
          <span className="text-[11px] text-[--admin-text-muted]">
            {selected.description}
          </span>
        ) : null}
      </label>

      <fieldset className="flex flex-col gap-2 rounded-md border border-[--admin-border] bg-white p-3">
        <legend className="px-1.5 text-[10px] font-semibold uppercase tracking-wider text-[--admin-text-muted]">
          Дополнительно
        </legend>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="wipe_profile"
            checked={wipeProfile}
            onChange={(e) => setWipeProfile(e.target.checked)}
            className="h-3.5 w-3.5 rounded"
          />
          Стереть анкету (user_profiles)
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="wipe_quiz"
            checked={wipeQuiz}
            onChange={(e) => setWipeQuiz(e.target.checked)}
            className="h-3.5 w-3.5 rounded"
          />
          Стереть ответы квиза (quiz_answers + quiz_results)
        </label>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center justify-center rounded-md text-xs font-semibold text-white transition hover:brightness-110 active:brightness-95 disabled:opacity-60"
        style={{ backgroundColor: "var(--admin-warn)" }}
      >
        {pending ? "Сбрасываем…" : "Применить сброс"}
      </button>
    </form>
  );
}
