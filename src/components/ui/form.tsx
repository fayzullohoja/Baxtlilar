"use client";

import { useState } from "react";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-[--color-ink-muted]">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-xs text-[--color-ink-muted]">{hint}</span>
      ) : null}
      {error ? (
        <span className="text-xs text-[--color-danger]">{error}</span>
      ) : null}
    </label>
  );
}

const radioBase =
  "flex cursor-pointer items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 text-[15px] transition";
const radioIdle = "border-[--color-line] text-[--color-plum]";
const radioChecked =
  "has-[:checked]:border-[--color-brand] has-[:checked]:bg-[--color-blush] has-[:checked]:text-[--color-brand-deep] has-[:checked]:font-semibold";

export function RadioList({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => (
        <label key={o.value} className={`${radioBase} ${radioIdle} ${radioChecked}`}>
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={defaultValue === o.value}
            className="sr-only"
            required
          />
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[--color-line]"
            aria-hidden
          >
            <span className="hidden h-2.5 w-2.5 rounded-full peer-checked:block" />
          </span>
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function CheckboxList({
  name,
  options,
  defaultValue = [],
  min,
  max,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string[];
  min?: number;
  max?: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultValue));
  function toggle(v: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(v)) next.delete(v);
      else if (max == null || next.size < max) next.add(v);
      return next;
    });
  }
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => {
        const checked = selected.has(o.value);
        return (
          <label
            key={o.value}
            className={
              "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 text-[15px] transition " +
              (checked
                ? "border-[--color-brand] bg-[--color-blush] text-[--color-brand-deep] font-semibold"
                : "border-[--color-line] bg-white text-[--color-plum]")
            }
          >
            <input
              type="checkbox"
              name={name}
              value={o.value}
              checked={checked}
              onChange={() => toggle(o.value)}
              className="sr-only"
            />
            <span
              className={
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border " +
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
            {o.label}
          </label>
        );
      })}
      {min || max ? (
        <p className="text-xs text-[--color-ink-muted]">
          Выбрано: {selected.size}
          {min ? ` (мин. ${min})` : ""}
          {max ? ` / макс. ${max}` : ""}
        </p>
      ) : null}
    </div>
  );
}

const inputBase =
  "h-12 rounded-2xl border border-[--color-line] bg-[--color-blush-soft] px-4 text-base text-[--color-plum] placeholder:text-[--color-ink-muted] transition";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={`${inputBase} ${props.className ?? ""}`} />
  );
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={
        "min-h-32 rounded-2xl border border-[--color-line] bg-[--color-blush-soft] px-4 py-3 text-base leading-relaxed text-[--color-plum] placeholder:text-[--color-ink-muted] transition resize-none " +
        (props.className ?? "")
      }
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputBase} appearance-none ${props.className ?? ""}`} />
  );
}
