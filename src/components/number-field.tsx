import type { ReactNode } from "react";

export function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  prefix,
  suffix,
  error,
  note,
  noteTone = "neutral",
  describedByExtra,
  labelAddon,
  onBlur,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  error?: string;
  note?: string | null;
  noteTone?: "neutral" | "caution";
  describedByExtra?: string;
  labelAddon?: ReactNode;
  onBlur?: (value: string) => void;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const noteId = `${id}-note`;
  const unit = accessibleUnit(prefix, suffix);
  const describedBy = [describedByExtra, hintId, note ? noteId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium text-white">
          {label}
          {unit ? <span className="sr-only">, {unit}</span> : null}
        </label>
        {labelAddon}
      </div>
      <div
        className={`field-shell flex h-12 items-center rounded-full border bg-void ${
          error ? "border-danger" : "border-border"
        }`}
      >
        {prefix ? (
          <span className="pl-4 text-sm text-muted" aria-hidden="true">
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur ? (event) => onBlur(event.target.value) : undefined}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="h-full w-full min-w-0 bg-transparent px-4 text-base tabular-nums text-white outline-none"
        />
        {suffix ? (
          <span className="pr-4 text-sm text-muted" aria-hidden="true">
            {suffix}
          </span>
        ) : null}
      </div>
      <p id={hintId} className="text-sm leading-5 text-muted">
        {hint}
      </p>
      {note ? (
        <p id={noteId} aria-live="polite" className={`text-sm leading-5 ${noteTone === "caution" ? "text-yellow" : "text-white"}`}>
          {note}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm leading-5 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function accessibleUnit(prefix?: string, suffix?: string): string | null {
  if (prefix === "S$") return "Singapore dollars";
  if (suffix === "%") return "percent";
  if (suffix === "years") return "years";
  if (prefix) return prefix;
  if (suffix) return suffix;
  return null;
}
