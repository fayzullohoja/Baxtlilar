"use client";

import { useState, useTransition } from "react";
import { REJECTION_TEMPLATES } from "@/lib/admin/rejection-templates";

export function RejectForm({
  rejectAction,
}: {
  rejectAction: (fd: FormData) => Promise<void>;
}) {
  const [kind, setKind] = useState(REJECTION_TEMPLATES[0].kind);
  const [reason, setReason] = useState(REJECTION_TEMPLATES[0].reason);
  const [pending, startTransition] = useTransition();

  function pickKind(newKind: string) {
    setKind(newKind);
    const tpl = REJECTION_TEMPLATES.find((t) => t.kind === newKind);
    if (tpl) setReason(tpl.reason);
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      await rejectAction(formData);
    });
  }

  const tpl = REJECTION_TEMPLATES.find((t) => t.kind === kind);
  const retake = tpl?.retake ?? "both";

  return (
    <form action={submit} className="flex flex-col gap-3 border-t border-[--admin-border] bg-[--admin-surface-2] px-4 py-4">
      {/* Hidden field carries the retake target the SQL needs */}
      <input type="hidden" name="kind" value={retake} />

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[--admin-text-muted]">
          Причина (шаблон)
        </span>
        <select
          value={kind}
          onChange={(e) => pickKind(e.target.value)}
          className="h-9 rounded-md border border-[--admin-border] bg-white px-2.5 text-sm text-[--admin-text]"
        >
          {REJECTION_TEMPLATES.map((t) => (
            <option key={t.kind} value={t.kind}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[--admin-text-muted]">
          Сообщение пользователю
        </span>
        <textarea
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Например: фото размыто, данные не читаются"
          required
          minLength={10}
          className="min-h-[88px] resize-none rounded-md border border-[--admin-border] bg-white px-3 py-2 text-sm leading-relaxed text-[--admin-text] placeholder:text-[--admin-text-muted]"
        />
        <span className="text-[11px] text-[--admin-text-muted]">
          {retake === "passport"
            ? "Пользователь увидит причину и переснимет паспорт"
            : retake === "selfie"
              ? "Пользователь увидит причину и переснимет selfie"
              : "Пользователь увидит причину и переснимет оба документа"}
        </span>
      </label>

      <button
        type="submit"
        disabled={pending || reason.trim().length < 10}
        className="inline-flex h-9 items-center justify-center rounded-md text-xs font-semibold text-white transition hover:brightness-110 active:brightness-95 disabled:opacity-50"
        style={{ backgroundColor: "var(--admin-danger)" }}
      >
        {pending ? "Отправляем…" : "Отправить отклонение"}
      </button>
    </form>
  );
}
