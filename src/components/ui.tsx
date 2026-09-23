"use client";

import { useEffect, useState } from "react";
import { formatINR, formatPct, signedTone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePrivacy } from "./providers";

export function Money({
  value,
  signed = false,
  className,
}: {
  value: string | null | undefined;
  signed?: boolean;
  className?: string;
}) {
  const { hidden } = usePrivacy();
  const tone = signed ? signedTone(value) : "flat";
  const label = tone === "gain" ? "Gain" : tone === "loss" ? "Loss" : "";
  return (
    <span className={cn("tabular", tone === "gain" && "text-emerald-700 dark:text-emerald-300", tone === "loss" && "text-rose-700 dark:text-rose-300", className)}>
      {label ? <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide">{label}</span> : null}
      {formatINR(value, hidden)}
    </span>
  );
}

export function Pct({ value, signed = false }: { value: string | null | undefined; signed?: boolean }) {
  const tone = signed ? signedTone(value) : "flat";
  return (
    <span className={cn("tabular", tone === "gain" && "text-emerald-700 dark:text-emerald-300", tone === "loss" && "text-rose-700 dark:text-rose-300")}>
      {formatPct(value, signed)}
    </span>
  );
}

export function Hint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="grid h-4 w-4 place-items-center rounded-full border border-border text-[10px] text-muted-foreground"
        aria-label={text}
      >
        i
      </button>
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-64 -translate-x-1/2 rounded-lg border bg-popover p-2 text-left text-xs font-normal leading-5 text-popover-foreground shadow group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  note,
  signed = false,
  icon,
}: {
  label: string;
  value: string | null;
  hint: string;
  note?: string;
  signed?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{label}</span>
          <span className="group">
            <Hint text={hint} />
          </span>
        </div>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground">{icon}</span>
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight">
        <Money value={value} signed={signed} />
      </p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </article>
  );
}

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full overflow-auto rounded-t-2xl border bg-card p-5 shadow-xl sm:max-w-2xl sm:rounded-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const fieldClass = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  hint,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  hint?: string;
  step?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-center gap-2 font-medium">
        {label}
        {hint ? (
          <span className="group">
            <Hint text={hint} />
          </span>
        ) : null}
      </span>
      <input className={fieldClass} name={name} type={type} defaultValue={defaultValue} required={required} step={step} />
    </label>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  options,
  onChange,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: { id: string; label: string }[];
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select
        className={fieldClass}
        name={name}
        defaultValue={defaultValue}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Check({ label, name, defaultChecked }: { label: string; name: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1" />
      <span>{label}</span>
    </label>
  );
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
      {error}
    </p>
  );
}

export function useSubmit(action: (form: FormData) => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await action(new FormData(event.currentTarget));
    setPending(false);
    if (!result.ok) setError(result.error || "Something went wrong.");
    else onOk?.();
  }
  return { error, pending, onSubmit, setError };
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function submitClass(pending?: boolean) {
  return cn("h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60", pending && "opacity-70");
}
