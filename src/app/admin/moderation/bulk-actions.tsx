"use client";

import {
  createContext,
  useContext,
  useState,
  useTransition,
  ReactNode,
} from "react";

interface BulkContextValue {
  selected: Set<string>;
  toggle: (id: string) => void;
  selectAll: () => void;
  clearAll: () => void;
  rowIds: string[];
  submitApprove: () => void;
  submitReject: (reason: string, kind: string) => void;
  pending: boolean;
}

const BulkContext = createContext<BulkContextValue | null>(null);

export function BulkProvider({
  children,
  rowIds,
  approveAction,
  rejectAction,
}: {
  children: ReactNode;
  rowIds: string[];
  approveAction: (fd: FormData) => Promise<void>;
  rejectAction: (fd: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(rowIds));
  }

  function clearAll() {
    setSelected(new Set());
  }

  function submitApprove() {
    if (selected.size === 0) return;
    if (!confirm(`Одобрить ${selected.size} ${plural(selected.size)}?`)) return;
    const fd = new FormData();
    for (const id of selected) fd.append("user_id", id);
    startTransition(async () => {
      await approveAction(fd);
      setSelected(new Set());
    });
  }

  function submitReject(reason: string, kind: string) {
    if (selected.size === 0) return;
    if (
      !confirm(
        `Отклонить ${selected.size} ${plural(selected.size)} с одинаковой причиной? Каждый юзер получит уведомление в Telegram.`,
      )
    ) {
      return;
    }
    const fd = new FormData();
    for (const id of selected) fd.append("user_id", id);
    fd.append("reason", reason);
    fd.append("kind", kind);
    startTransition(async () => {
      await rejectAction(fd);
      setSelected(new Set());
    });
  }

  return (
    <BulkContext.Provider
      value={{
        selected,
        toggle,
        selectAll,
        clearAll,
        rowIds,
        submitApprove,
        submitReject,
        pending,
      }}
    >
      {children}
    </BulkContext.Provider>
  );
}

export function BulkBar() {
  const ctx = useContext(BulkContext);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<"passport" | "selfie" | "both">("both");
  if (!ctx) return null;
  const { selected, selectAll, clearAll, rowIds, submitApprove, submitReject, pending } =
    ctx;

  if (selected.size === 0) {
    return (
      <div className="flex items-center justify-between border-b border-[--admin-border] bg-[--admin-surface-2] px-4 py-2 text-xs text-[--admin-text-muted]">
        <span>Выбирай чекбоксами слева, чтобы обработать пачкой</span>
        <button
          type="button"
          onClick={selectAll}
          className="font-medium text-[--admin-info] hover:underline"
        >
          выбрать все ({rowIds.length})
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-b border-[--admin-border] bg-[--admin-info-bg] px-4 py-2.5 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-[--admin-info]">
            Выбрано: {selected.size}
          </span>
          <button
            type="button"
            onClick={selectAll}
            className="text-[--admin-info] hover:underline"
          >
            все ({rowIds.length})
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="text-[--admin-text-muted] hover:text-[--admin-text]"
          >
            снять выделение
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setRejectMode((v) => !v)}
            disabled={pending}
            className="inline-flex h-7 items-center rounded-md border border-[--admin-border] bg-white px-2.5 text-xs font-medium text-[--admin-danger] hover:brightness-95 disabled:opacity-60"
          >
            Отклонить N…
          </button>
          <button
            type="button"
            onClick={submitApprove}
            disabled={pending}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white shadow-[var(--admin-shadow-sm)] transition hover:brightness-110 disabled:opacity-60"
            style={{ backgroundColor: "var(--admin-success)" }}
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 6L5 8.5l4.5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {pending ? "Одобряем…" : `Одобрить ${selected.size}`}
          </button>
        </div>
      </div>

      {rejectMode ? (
        <div className="flex flex-col gap-2 rounded-md border border-[--admin-danger-border] bg-white p-3">
          <p className="text-xs font-semibold text-[--admin-danger]">
            Отклонить {selected.size} {plural(selected.size)} с одной причиной
          </p>
          <select
            value={kind}
            onChange={(e) =>
              setKind(e.target.value as "passport" | "selfie" | "both")
            }
            className="h-8 rounded-md border border-[--admin-border] bg-white px-2 text-xs text-[--admin-text]"
          >
            <option value="passport">Только паспорт</option>
            <option value="selfie">Только selfie</option>
            <option value="both">Оба фото</option>
          </select>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Причина (минимум 10 символов)…"
            className="min-h-[60px] resize-none rounded-md border border-[--admin-border] bg-white px-2.5 py-1.5 text-xs text-[--admin-text] placeholder:text-[--admin-text-muted]"
            minLength={10}
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => submitReject(reason.trim(), kind)}
              disabled={pending || reason.trim().length < 10}
              className="inline-flex h-7 items-center rounded-md px-3 text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--admin-danger)" }}
            >
              {pending ? "Отклоняем…" : "Подтвердить отклонение"}
            </button>
            <button
              type="button"
              onClick={() => setRejectMode(false)}
              className="inline-flex h-7 items-center rounded-md border border-[--admin-border] bg-white px-3 text-xs font-medium text-[--admin-text-2]"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BulkCheckbox({ id }: { id: string }) {
  const ctx = useContext(BulkContext);
  if (!ctx) return null;
  return (
    <input
      type="checkbox"
      checked={ctx.selected.has(id)}
      onClick={(e) => e.stopPropagation()}
      onChange={() => ctx.toggle(id)}
      className="h-4 w-4 cursor-pointer rounded border-[--admin-border-strong]"
      aria-label="Выбрать заявку"
    />
  );
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "заявку";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "заявки";
  return "заявок";
}
