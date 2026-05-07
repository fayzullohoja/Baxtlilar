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
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

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
        <label
          key={o.value}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={defaultValue === o.value}
            className="sr-only"
            required
          />
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
              "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition " +
              (checked
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-900")
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
            {o.label}
          </label>
        );
      })}
      {min || max ? (
        <p className="text-xs text-neutral-500">
          Выбрано: {selected.size}
          {min ? ` (мин. ${min})` : ""}
          {max ? ` / макс. ${max}` : ""}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <input
      {...props}
      className={
        "h-12 rounded-xl border border-neutral-300 bg-white px-4 text-base focus:border-neutral-900 focus:outline-none " +
        (props.className ?? "")
      }
    />
  );
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={
        "min-h-32 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base focus:border-neutral-900 focus:outline-none " +
        (props.className ?? "")
      }
    />
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <select
      {...props}
      className={
        "h-12 rounded-xl border border-neutral-300 bg-white px-4 text-base focus:border-neutral-900 focus:outline-none " +
        (props.className ?? "")
      }
    />
  );
}
