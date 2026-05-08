"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/screen";

export function QuizQuestionForm({
  options,
  multi,
  submitAction,
  backAction,
  existing,
  labels,
}: {
  questionId: string;
  options: { id: string; label: string }[];
  multi?: { min: number; max: number };
  submitAction: (fd: FormData) => Promise<void>;
  backAction: () => Promise<void>;
  existing: string | string[] | null;
  labels: { submit: string; back: string };
}) {
  const initialSelected = existing
    ? Array.isArray(existing)
      ? existing
      : [existing]
    : [];
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    if (!multi) {
      setSelected([id]);
      return;
    }
    setSelected((curr) => {
      if (curr.includes(id)) return curr.filter((x) => x !== id);
      if (curr.length >= multi.max) return curr;
      return [...curr, id];
    });
  }

  function submit() {
    const fd = new FormData();
    for (const id of selected) fd.append("opt", id);
    startTransition(async () => {
      await submitAction(fd);
    });
  }

  const canSubmit =
    multi
      ? selected.length >= multi.min && selected.length <= multi.max
      : selected.length === 1;

  return (
    <div className="flex flex-col gap-2.5">
      {options.map((o) => {
        const checked = selected.includes(o.id);
        return (
          <button
            type="button"
            key={o.id}
            onClick={() => toggle(o.id)}
            className={
              "flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-[15px] leading-snug transition " +
              (checked
                ? "border-[--color-brand] bg-[--color-blush] text-[--color-brand-deep] font-semibold shadow-[0_4px_16px_rgba(255,111,145,0.12)]"
                : "border-[--color-line] bg-white text-[--color-plum] hover:border-[--color-brand-border]")
            }
          >
            <span
              className={
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border " +
                (checked
                  ? "border-[--color-brand] bg-[--color-brand] text-white"
                  : "border-[--color-line]")
              }
              aria-hidden
            >
              {checked ? (
                <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none">
                  <path
                    d="M3 7.5l2.5 2.5L11 4.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>
            <span className="flex-1">{o.label}</span>
          </button>
        );
      })}
      <div className="mt-5 flex flex-col gap-2">
        <PrimaryButton onClick={submit} disabled={pending || !canSubmit}>
          {pending ? "…" : labels.submit}
        </PrimaryButton>
        <SecondaryButton
          type="button"
          onClick={() =>
            startTransition(async () => {
              await backAction();
            })
          }
        >
          {labels.back}
        </SecondaryButton>
      </div>
    </div>
  );
}
