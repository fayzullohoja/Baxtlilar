"use client";

import { createContext, useContext, useState, useTransition, ReactNode } from "react";

interface BulkContextValue {
  selected: Set<string>;
  toggle: (id: string) => void;
  selectAll: () => void;
  clearAll: () => void;
  rowIds: string[];
  submitApprove: () => void;
  pending: boolean;
}

const BulkContext = createContext<BulkContextValue | null>(null);

export function BulkProvider({
  children,
  rowIds,
  approveAction,
}: {
  children: ReactNode;
  rowIds: string[];
  approveAction: (fd: FormData) => Promise<void>;
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

  return (
    <BulkContext.Provider
      value={{ selected, toggle, selectAll, clearAll, rowIds, submitApprove, pending }}
    >
      {children}
    </BulkContext.Provider>
  );
}

export function BulkBar() {
  const ctx = useContext(BulkContext);
  if (!ctx) return null;
  const { selected, selectAll, clearAll, rowIds, submitApprove, pending } = ctx;

  if (selected.size === 0) {
    return (
      <div className="flex items-center justify-between border-b border-[--admin-border] bg-[--admin-surface-2] px-4 py-2 text-xs text-[--admin-text-muted]">
        <span>
          Выбирай чекбоксами слева, чтобы одобрить пачкой
        </span>
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
    <div className="flex items-center justify-between border-b border-[--admin-border] bg-[--admin-info-bg] px-4 py-2.5 text-xs">
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
