"use client";

import { useState, useTransition } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/screen";

export function QuizQuestionForm({
  questionId,
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
    <div className="flex flex-col gap-3">
      {options.map((o) => {
        const checked = selected.includes(o.id);
        return (
          <button
            type="button"
            key={o.id}
            onClick={() => toggle(o.id)}
            className={
              "rounded-xl border p-4 text-left text-sm transition " +
              (checked
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-900")
            }
          >
            {o.label}
          </button>
        );
      })}
      <div className="mt-4 flex flex-col gap-2">
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
