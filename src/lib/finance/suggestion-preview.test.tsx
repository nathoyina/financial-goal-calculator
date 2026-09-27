import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { clearTrackedEvents, getTrackedEvents, track } from "../analytics/track";
import { formatMoney } from "./format";
import { calculatePlan } from "./plan";
import { DEFAULT_PLAN_FORM, parsePlanForm, type PlanFormState } from "./plan-form";
import { SuggestionChoices, SuggestionPreviewCard } from "@/components/suggestion-preview";
import {
  SUGGESTION_PREVIEW_ID,
  applySuggestion,
  dismissSuggestion,
  tapSuggestion,
  type SuggestionView,
} from "./suggestion-preview";

function shortfallForm(): PlanFormState {
  return {
    ...DEFAULT_PLAN_FORM,
    currentAge: "40",
    retirementAge: "42",
    lifeExpectancy: "44",
    cashSavings: "0",
    monthlyIncome: "3750",
    annualIncomeGrowth: "0",
    monthlyExpensesNow: "2000",
    monthlyRetirementSpendingToday: "2000",
    annualReturn: "0",
    annualInflation: "0",
    extraMonthlySaving: "0",
    includeCpf: false,
    cpfAnswer: "no",
    loanAnswer: "no",
    hasLoan: false,
    childrenAnswer: "no",
    children: [],
  };
}

function view(): SuggestionView {
  return { form: shortfallForm(), preview: null };
}

describe("suggestion preview", () => {
  it("leaves the inputs and the current verdict unchanged when a suggestion is tapped", () => {
    const original = view();
    const before = parsePlanForm(original.form);
    expect(before.ok && before.result.canRetire).toBe(false);
    const gap = before.ok ? before.result.gap : null;
    const cash = before.ok ? before.result.projectedCashAtRetirement : null;

    const opened = tapSuggestion(original, "earliest-age");

    expect(opened.view.form).toBe(original.form);
    expect(opened.event).toEqual({ name: "Gap Suggestion Previewed", type: "earliest-age" });
    const after = parsePlanForm(opened.view.form);
    expect(after.ok && after.result.canRetire).toBe(false);
    expect(after.ok && after.result.gap).toBe(gap);
    expect(after.ok && after.result.projectedCashAtRetirement).toBe(cash);
    expect(opened.view.preview?.canRetire).toBe(true);
    expect(opened.view.preview?.sentence).toBe("At 43: you can retire");
  });

  it("previews each suggestion from a fresh run and keeps only one preview", () => {
    const original = view();
    const parsed = parsePlanForm(original.form);
    if (!parsed.ok) throw new Error(parsed.error.message);

    const extra = tapSuggestion(original, "extra-saving");
    expect(extra.view.form).toEqual(original.form);
    expect(extra.view.preview?.sentence).toBe(
      `Saving ${formatMoney(parsed.result.extraMonthlySaving ?? 0)} more a month: you can retire`,
    );
    expect(extra.view.preview?.canRetire).toBe(true);
    const extraPlan = parsePlanForm({ ...original.form, ...extra.view.preview!.patch });
    expect(extraPlan.ok && extraPlan.result.canRetire).toBe(true);
    expect(extra.view.preview?.patch.extraMonthlySaving).toBe(
      String(Math.ceil(parsed.result.extraMonthlySaving ?? 0)),
    );

    const spending = tapSuggestion(extra.view, "spending-cut");
    expect(spending.view.preview?.type).toBe("spending-cut");
    expect(spending.view.preview?.type).not.toBe(extra.view.preview?.type);
    expect(spending.view.form).toBe(original.form);
    expect(spending.view.preview?.sentence).toBe(
      `Spending ${formatMoney(parsed.result.spendingCutToday ?? 0)} less a month in retirement: you can retire`,
    );
    expect(spending.view.preview?.canRetire).toBe(true);

    const now = tapSuggestion({ form: original.form, preview: null }, "spend-less-now");
    expect(now.view.preview?.sentence).toMatch(/^Spending S\$[\d,]+ less a month now: you can retire$/);
    expect(now.view.form.monthlyExpensesNow).toBe(original.form.monthlyExpensesNow);
  });

  it("applies the preview to the inputs and dismiss clears it without applying", () => {
    const original = view();
    const opened = tapSuggestion(original, "earliest-age");
    const dismissed = dismissSuggestion(opened.view);
    expect(dismissed.view.preview).toBeNull();
    expect(dismissed.view.form).toBe(original.form);
    expect(dismissed.event).toBeNull();

    const applied = applySuggestion(opened.view);
    expect(applied.event).toEqual({ name: "Gap Suggestion Applied", type: "earliest-age" });
    expect(applied.view.preview).toBeNull();
    expect(applied.view.form.retirementAge).toBe("43");
    expect(applied.view.form.monthlyRetirementSpendingToday).toBe(original.form.monthlyRetirementSpendingToday);
    expect(parsePlanForm(applied.view.form).ok && parsePlanForm(applied.view.form)).toMatchObject({
      ok: true,
      result: { canRetire: true },
    });
    const untouched = parsePlanForm(original.form);
    expect(untouched.ok).toBe(true);
    if (untouched.ok) expect(untouched.result.canRetire).toBe(false);
  });

  it("tracks a preview on tap and an apply only when the preview is applied, with no amounts", () => {
    clearTrackedEvents();
    const opened = tapSuggestion(view(), "extra-saving");
    const applied = applySuggestion(opened.view);
    for (const step of [opened, applied]) {
      if (step.event) track(step.event.name, { type: step.event.type });
    }
    expect(getTrackedEvents().map((event) => event.event)).toEqual([
      "Gap Suggestion Previewed",
      "Gap Suggestion Applied",
    ]);
    expect(getTrackedEvents().map((event) => event.props)).toEqual([
      { type: "extra-saving" },
      { type: "extra-saving" },
    ]);
    expect(JSON.stringify(getTrackedEvents())).not.toMatch(/\d|S\$|salary|balance/);
  });

  it("marks the open suggestion as a disclosure and announces the preview", () => {
    const parsed = parsePlanForm(shortfallForm());
    if (!parsed.ok) throw new Error(parsed.error.message);
    const closed = renderToStaticMarkup(
      <SuggestionChoices result={parsed.result} openType={null} onPreview={() => undefined} />,
    );
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain(`aria-controls="${SUGGESTION_PREVIEW_ID}"`);
    expect(closed).not.toContain("Apply");

    const opened = tapSuggestion(view(), "earliest-age");
    const html = renderToStaticMarkup(
      <>
        <SuggestionChoices result={parsed.result} openType="earliest-age" onPreview={() => undefined} />
        <SuggestionPreviewCard preview={opened.view.preview!} onApply={() => undefined} onDismiss={() => undefined} />
      </>,
    );
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("At 43: you can retire");
    expect(html).toContain(">Apply<");
    expect(html).toContain(">Dismiss<");
    expect(calculatePlan(parsed.input).canRetire).toBe(false);
  });
});
