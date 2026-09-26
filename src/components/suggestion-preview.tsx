import type { ReactNode, Ref } from "react";
import {
  SUGGESTION_PREVIEW_ID,
  suggestionChoices,
  type GapSuggestionType,
  type SuggestionPreview,
} from "@/lib/finance/suggestion-preview";
import type { PlanResult } from "@/lib/finance/plan";

export function SuggestionButton({
  type,
  label,
  expanded,
  className,
  onPreview,
  buttonRef,
}: {
  type: GapSuggestionType;
  label: string;
  expanded: boolean;
  className: string;
  onPreview: (type: GapSuggestionType) => void;
  buttonRef?: (node: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-expanded={expanded}
      aria-controls={SUGGESTION_PREVIEW_ID}
      onClick={() => onPreview(type)}
      ref={buttonRef}
    >
      {label}
    </button>
  );
}

export function SuggestionChoices({
  result,
  openType,
  onPreview,
  registerButton,
}: {
  result: PlanResult;
  openType: GapSuggestionType | null;
  onPreview: (type: GapSuggestionType) => void;
  registerButton?: (type: GapSuggestionType, node: HTMLButtonElement | null) => void;
}) {
  const choices = suggestionChoices(result);
  return (
    <>
      {result.earliestRetirementAge === null ? (
        <p className="text-sm leading-6 text-muted">No later age before the planning age makes this spending last.</p>
      ) : null}
      {choices.map((choice) => (
        <SuggestionButton
          key={choice.type}
          type={choice.type}
          label={choice.label}
          expanded={openType === choice.type}
          className={`pill text-left ${choice.type === "earliest-age" ? "pill-shout" : "pill-ghost"}`}
          onPreview={onPreview}
          buttonRef={registerButton ? (node) => registerButton(choice.type, node) : undefined}
        />
      ))}
    </>
  );
}

export function SuggestionPreviewCard({
  preview,
  panelRef,
  onApply,
  onDismiss,
}: {
  preview: SuggestionPreview;
  panelRef?: Ref<HTMLDivElement>;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      id={SUGGESTION_PREVIEW_ID}
      ref={panelRef}
      tabIndex={-1}
      role="region"
      aria-labelledby="suggestion-preview-result"
      className="glass scroll-mt-6 p-5 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-yellow sm:p-8"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }}
    >
      <p className="text-xs font-semibold tracking-[0.18em] text-yellow uppercase">Preview</p>
      <p id="suggestion-preview-result" role="status" aria-live="polite" className="mt-2 text-2xl font-extrabold tracking-tight text-white">
        {preview.sentence}
      </p>
      <p className="mt-2 text-sm leading-5 text-muted">Your plan, chart, and numbers stay as they are until you apply this.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="pill pill-shout" onClick={onApply}>
          Apply
        </button>
        <button type="button" className="pill pill-ghost" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function VerdictWithPreview({
  verdict,
  preview,
  panelRef,
  onApply,
  onDismiss,
}: {
  verdict: ReactNode;
  preview: SuggestionPreview | null;
  panelRef?: Ref<HTMLDivElement>;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className={preview ? "grid items-start gap-3 sm:grid-cols-2" : undefined}>
      {verdict}
      {preview ? (
        <SuggestionPreviewCard preview={preview} panelRef={panelRef} onApply={onApply} onDismiss={onDismiss} />
      ) : null}
    </div>
  );
}
