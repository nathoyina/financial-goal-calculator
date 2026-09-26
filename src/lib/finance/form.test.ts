import { describe, expect, it } from "vitest";
import { DEFAULT_FORM, parseDecimal, parseRetirementForm } from "./form";

describe("parseRetirementForm", () => {
  it("parses grouped amounts and percent inputs", () => {
    expect(parseDecimal("150,000")).toBe(150000);
    expect(parseDecimal("2.5%")).toBe(2.5);
    expect(parseDecimal(".5")).toBe(0.5);
    expect(parseDecimal("abc")).toBeNull();

    const parsed = parseRetirementForm(
      { ...DEFAULT_FORM, currentSavings: "150,000", annualReturnPercent: "5%" },
      { includeRetirementIncome: false },
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.currentSavings).toBe(150000);
    expect(parsed.input.annualReturn).toBeCloseTo(0.05);
    expect(parsed.input.monthlyRetirementIncomeToday).toBe(0);
  });

  it("ignores CPF LIFE unless Singapore mode is on", () => {
    const form = { ...DEFAULT_FORM, monthlyRetirementIncomeToday: "800" };
    const off = parseRetirementForm(form, { includeRetirementIncome: false });
    const on = parseRetirementForm(form, { includeRetirementIncome: true });
    expect(off.ok && on.ok).toBe(true);
    if (!off.ok || !on.ok) return;
    expect(off.input.monthlyRetirementIncomeToday).toBe(0);
    expect(on.input.monthlyRetirementIncomeToday).toBe(800);
    expect(on.result.nestEggNeeded).toBeLessThan(off.result.nestEggNeeded);
  });

  it("reports an empty field and an impossible horizon separately", () => {
    const empty = parseRetirementForm(
      { ...DEFAULT_FORM, monthlyContribution: "" },
      { includeRetirementIncome: false },
    );
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.fieldErrors.monthlyContribution).toMatch(/number/i);

    const ages = parseRetirementForm(
      { ...DEFAULT_FORM, currentAge: "70", retirementAge: "80", lifeExpectancy: "75" },
      { includeRetirementIncome: false },
    );
    expect(ages.ok).toBe(false);
    if (ages.ok) return;
    expect(ages.formError).toMatch(/life expectancy/i);
  });
});
