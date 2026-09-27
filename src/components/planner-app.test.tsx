import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlannerApp } from "@/components/planner-app";
import { DEFAULT_PLAN_FORM, parsePlanForm } from "@/lib/finance/plan-form";
import { calculatePlan } from "@/lib/finance/plan";

function screen(step: number): string {
  return renderToStaticMarkup(<PlannerApp initialStep={step} />);
}

describe("CPF balances step", () => {
  it("opens on the balance fields, with Continue and no Yes or No", () => {
    const html = screen(3);
    const expenses = screen(1);

    expect(html).toContain("CPF balances");
    expect(html).toContain("Step 4 of 5 · CPF");
    expect(html).toContain(">Continue<");
    expect(html).toContain('type="button"');
    expect(html).not.toContain("Add your CPF balances to the plan?");
    expect(html).not.toContain('id="cpf-yes"');
    expect(html).not.toContain('id="cpf-no"');
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain("aria-controls");
    expect(html).not.toContain("aria-expanded");

    for (const id of ["oa", "sa", "ra", "ma", "payout-age"]) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`for="${id}"`);
    }
    expect(html).toContain("Ordinary Account (OA)");
    expect(html).toContain("Special Account (SA)");
    expect(html).toContain("Retirement Account (RA)");
    expect(html).toContain("MediSave (MA)");
    expect(html).toContain("CPF LIFE payout age");
    expect(html).toContain('value="0"');
    expect(html).toContain('value="65"');
    expect(html).toContain("Use 0 if an account is empty.");

    expect(html).toContain('class="flex flex-col gap-4"');
    expect(html).toContain("text-sm leading-6 text-muted");
    expect(html).toContain("text-sm font-medium text-white");
    expect(expenses).toContain("text-sm leading-6 text-muted");
    expect(expenses).toContain("text-sm font-medium text-white");
    expect(expenses).toContain(">Continue<");
    expect(expenses).not.toContain("aria-pressed");
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

  it("keeps the default plan on the same result as leaving CPF balances out", () => {
    const parsed = parsePlanForm(DEFAULT_PLAN_FORM);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const leftOut = calculatePlan({
      ...parsed.input,
      includeCpf: false,
      cpf: { oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
    });
    expect(parsed.result.gap).toBeCloseTo(leftOut.gap, 6);
    expect(parsed.result.cpfLifeMonthly).toBe(0);
    expect(parsed.result.projectedCashAtRetirement).toBeCloseTo(leftOut.projectedCashAtRetirement, 6);
    expect(parsed.result.nestEggNeeded).toBeCloseTo(leftOut.nestEggNeeded, 6);
    expect(DEFAULT_PLAN_FORM.oa).toBe("0");
    expect(DEFAULT_PLAN_FORM.sa).toBe("0");
    expect(DEFAULT_PLAN_FORM.ra).toBe("0");
    expect(DEFAULT_PLAN_FORM.ma).toBe("0");
    expect(DEFAULT_PLAN_FORM.payoutAge).toBe("65");
  });
});
