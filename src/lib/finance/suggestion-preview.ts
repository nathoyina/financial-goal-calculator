import { formatMoney } from "./format";
import type { PlanInput, PlanResult } from "./plan";
import { parseDecimal, parsePlanForm, type PlanFormState } from "./plan-form";

export const GAP_SUGGESTION_TYPES = ["earliest-age", "extra-saving", "spend-less-now", "spending-cut"] as const;

export type GapSuggestionType = (typeof GAP_SUGGESTION_TYPES)[number];

export const SUGGESTION_PREVIEW_ID = "suggestion-preview";

export interface SuggestionPreview {
  type: GapSuggestionType;
  patch: Partial<PlanFormState>;
  sentence: string;
  canRetire: boolean;
}

export interface SuggestionView {
  form: PlanFormState;
  preview: SuggestionPreview | null;
}

export interface SuggestionEvent {
  name: "Gap Suggestion Previewed" | "Gap Suggestion Applied";
  type: GapSuggestionType;
}

export interface SuggestionStep {
  view: SuggestionView;
  event: SuggestionEvent | null;
  focus: "preview" | "suggestion" | "verdict" | null;
}

export interface SuggestionChoice {
  type: GapSuggestionType;
  label: string;
}

function unchanged(view: SuggestionView): SuggestionStep {
  return { view, event: null, focus: null };
}

/** The same field change the Apply pill writes into the form. */
export function suggestionPatch(
  form: PlanFormState,
  input: PlanInput,
  result: PlanResult,
  type: GapSuggestionType,
): Partial<PlanFormState> | null {
  if (type === "earliest-age") {
    if (result.earliestRetirementAge === null) return null;
    return { retirementAge: String(result.earliestRetirementAge) };
  }
  if (type === "extra-saving") {
    if (result.extraMonthlySaving === null) return null;
    const currentExtra = parseDecimal(form.extraMonthlySaving) ?? input.extraMonthlySaving;
    return { extraMonthlySaving: String(Math.ceil(currentExtra + result.extraMonthlySaving)) };
  }
  if (type === "spend-less-now") {
    if (result.spendingCutNow === null || Math.round(result.spendingCutNow) < 1) return null;
    return {
      monthlyExpensesNow: String(Math.max(0, Math.floor(input.monthlyExpensesNow - result.spendingCutNow))),
    };
  }
  if (result.spendingCutToday === null) return null;
  return {
    monthlyRetirementSpendingToday: String(
      Math.max(0, Math.floor(input.monthlyRetirementSpendingToday - result.spendingCutToday)),
    ),
  };
}

export function suggestionChoices(result: PlanResult): SuggestionChoice[] {
  const choices: SuggestionChoice[] = [];
  if (result.earliestRetirementAge !== null) {
    choices.push({ type: "earliest-age", label: `Retire at ${result.earliestRetirementAge} instead` });
  }
  if (result.extraMonthlySaving !== null) {
    choices.push({
      type: "extra-saving",
      label: `Save ${formatMoney(result.extraMonthlySaving)} more each month`,
    });
  }
  if (result.spendingCutNow !== null && Math.round(result.spendingCutNow) >= 1) {
    choices.push({
      type: "spend-less-now",
      label: `Spend ${formatMoney(result.spendingCutNow)} less each month now`,
    });
  }
  if (result.spendingCutToday !== null) {
    choices.push({
      type: "spending-cut",
      label: `Spend ${formatMoney(result.spendingCutToday)} less each month in retirement`,
    });
  }
  return choices;
}

function previewLead(type: GapSuggestionType, result: PlanResult, patch: Partial<PlanFormState>): string {
  if (type === "earliest-age") return `At ${patch.retirementAge}`;
  if (type === "extra-saving") return `Saving ${formatMoney(result.extraMonthlySaving ?? 0)} more a month`;
  if (type === "spend-less-now") return `Spending ${formatMoney(result.spendingCutNow ?? 0)} less a month now`;
  return `Spending ${formatMoney(result.spendingCutToday ?? 0)} less a month in retirement`;
}

/** Re-runs the plan with one change. The original form is not modified. */
export function buildSuggestionPreview(form: PlanFormState, type: GapSuggestionType): SuggestionPreview | null {
  const parsed = parsePlanForm(form);
  if (!parsed.ok || parsed.result.canRetire) return null;
  const patch = suggestionPatch(form, parsed.input, parsed.result, type);
  if (!patch) return null;
  const previewed = parsePlanForm({ ...form, ...patch });
  if (!previewed.ok) return null;
  const outcome = previewed.result.canRetire ? "you can retire" : "you cannot retire";
  return {
    type,
    patch,
    canRetire: previewed.result.canRetire,
    sentence: `${previewLead(type, parsed.result, patch)}: ${outcome}`,
  };
}

/** A tap opens one preview, or closes it when that suggestion is already open. Inputs stay put. */
export function tapSuggestion(view: SuggestionView, type: GapSuggestionType): SuggestionStep {
  if (view.preview?.type === type) {
    return { view: { form: view.form, preview: null }, event: null, focus: "suggestion" };
  }
  const preview = buildSuggestionPreview(view.form, type);
  if (!preview) return unchanged(view);
  return {
    view: { form: view.form, preview },
    event: { name: "Gap Suggestion Previewed", type },
    focus: "preview",
  };
}

export function dismissSuggestion(view: SuggestionView): SuggestionStep {
  if (!view.preview) return unchanged(view);
  return { view: { form: view.form, preview: null }, event: null, focus: "suggestion" };
}

/** Apply is the only step that writes the preview onto the form. */
export function applySuggestion(view: SuggestionView): SuggestionStep {
  if (!view.preview) return unchanged(view);
  return {
    view: { form: { ...view.form, ...view.preview.patch }, preview: null },
    event: { name: "Gap Suggestion Applied", type: view.preview.type },
    focus: "verdict",
  };
}
