export function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  prefix,
  suffix,
  error,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  error?: string;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? `${hintId} ${errorId}` : hintId;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-white">
        {label}
      </label>
      <div
        className={`flex h-12 items-center rounded-full border bg-void ${
          error ? "border-danger" : "border-border focus-within:border-yellow focus-within:ring-2 focus-within:ring-yellow"
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
      {error ? (
        <p id={errorId} className="text-sm leading-5 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
