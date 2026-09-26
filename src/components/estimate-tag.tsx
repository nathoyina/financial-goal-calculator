"use client";

import { useEffect, useRef, useState } from "react";

export function EstimateTag({
  id,
  explanation,
  onOpen,
}: {
  id: string;
  explanation: string;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = `${id}-note`;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="inline-flex max-w-full flex-col items-start gap-2 align-middle">
      <button
        ref={buttonRef}
        type="button"
        className="min-h-11 rounded-full border border-border px-3 text-sm font-medium text-muted"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => {
            if (!current) onOpen();
            return !current;
          });
        }}
      >
        Estimate
      </button>
      {open ? (
        <span id={panelId} role="note" className="max-w-sm text-sm leading-5 text-muted">
          {explanation}
        </span>
      ) : null}
    </span>
  );
}
