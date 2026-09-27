import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlannerApp } from "@/components/planner-app";
import { DEFAULT_PLAN_FORM, parsePlanForm, type PlanFormState } from "@/lib/finance/plan-form";
import { calculatePlan } from "@/lib/finance/plan";

function screen(step: number, form: PlanFormState = DEFAULT_PLAN_FORM): string {
  return renderToStaticMarkup(<PlannerApp initialStep={step} initialForm={form} />);
}

describe("CPF balances step", () => {
  it("opens on empty Ordinary, Special, and MediSave fields, with Continue and no Yes or No", () => {
    const html = screen(3);
    const expenses = screen(1);

    expect(html).toContain("Your CPF balances today");
    expect(html).toContain("Step 4 of 5 · CPF");
    expect(html).toContain(">Continue<");
    expect(html).not.toContain("Add your CPF balances");
    expect(html).not.toContain('id="cpf-yes"');
    expect(html).not.toContain('id="cpf-no"');
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain("aria-controls");
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain('id="ra"');

    for (const id of ["oa", "sa", "ma"]) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`placeholder="0"`);
    }
    expect(html).toContain("Ordinary Account (OA)");
    expect(html).toContain("Special Account (SA)");
    expect(html).toContain("MediSave (MA)");
    expect(html).toContain('value=""');
    expect(html).toContain("Your balances are in the CPF app or at cpf.gov.sg after you log in with Singpass.");
    expect(html).toContain("text-sm leading-6 text-muted");
    expect(html).toContain("text-sm font-medium text-white");
    expect(html).toContain("placeholder:text-muted");
    expect(expenses).toContain("text-sm font-medium text-white");
    expect(expenses).toContain(">Continue<");
  });

  it("shows the Retirement Account instead of the Special Account from age 55", () => {
    const html = screen(3, { ...DEFAULT_PLAN_FORM, currentAge: "60" });
    expect(html).toContain('id="ra"');
    expect(html).toContain("Retirement Account (RA)");
    expect(html).toContain('placeholder="0"');
    expect(html).not.toContain('id="sa"');
    expect(html).not.toContain("aria-pressed");
    expect(html).toContain(">Continue<");
  });

  it("leaves the housing and education Yes or No questions in place", () => {
    const housing = screen(2);
    const education = screen(4);
    expect(housing).toContain('id="loan-yes"');
    expect(housing).toContain('id="loan-no"');
    expect(housing).toContain("aria-pressed");
    expect(housing).toContain("aria-controls");
    expect(education).toContain('id="children-yes"');
    expect(education).toContain('id="children-no"');
    expect(education).toContain("aria-pressed");
  });

  it("keeps CPF in the default plan when the balance fields are left empty", () => {
    const parsed = parsePlanForm(DEFAULT_PLAN_FORM);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const previous = calculatePlan({
      ...parsed.input,
      cpf: { oa: 40_000, sa: 25_000, ra: 0, ma: 15_000, payoutAge: 65 },
    });
    expect(parsed.input.includeCpf).toBe(true);
    expect(parsed.input.cpf).toEqual({ oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 });
    expect(parsed.result.gap).not.toBeCloseTo(previous.gap, 0);
    expect(parsed.result.cpfLifeMonthly).toBeGreaterThan(0);
  });
});
