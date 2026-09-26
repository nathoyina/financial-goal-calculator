"use client";

import { useState } from "react";

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
  const panelId = `${id}-note`;

  const reveal = () => {
    setOpen((current) => {
      if (!current) onOpen();
      return true;
    });
  };

  return (
    <span className="inline-flex max-w-full flex-col items-start gap-2 align-middle">
      <button
        type="button"
        className="min-h-11 rounded-full border border-border px-3 text-sm font-medium text-muted"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          reveal();
        }}
        onFocus={reveal}
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
