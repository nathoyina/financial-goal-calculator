import { describe, expect, it } from "vitest";
import { calculatePlan, estimateNotice, type PlanInput } from "./plan";
import { DEFAULT_PLAN_FORM, parsePlanForm, skipDiscardNote, skipLabel, stepWouldDiscardEntries, validateStep } from "./plan-form";
import { parseDecimal } from "./parse";
import {
  cpfLifeDollarYear,
  cpfLifeInTodaysMoney,
  projectedSalaryExceedsCeiling,
  spendingExceedsTakeHome,
  takeHomeExcessSentence,
  takeHomePay,
  yearsUntilRetirementLine,
} from "./guidance";

const base: PlanInput = {
  currentAge: 40,
  retirementAge: 42,
  lifeExpectancy: 44,
  cashSavings: 0,
  monthlyIncome: 3_000,
  annualIncomeGrowth: 0,
  monthlyExpensesNow: 2_000,
  monthlyRetirementSpendingToday: 1_000,
  annualReturn: 0,
  annualInflation: 0,
  extraMonthlySaving: 0,
  includeCpf: false,
  cpf: { oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
  loan: null,
  children: [],
};

describe("money parsing", () => {
  it("accepts currency symbols, commas, and spaces, and rejects other text", () => {
    expect(parseDecimal("S$1,200")).toBe(1200);
    expect(parseDecimal("s$1,200.50")).toBe(1200.5);
    expect(parseDecimal("$1,200")).toBe(1200);
    expect(parseDecimal("1,200")).toBe(1200);
    expect(parseDecimal("1 200")).toBe(1200);
    expect(parseDecimal("  S$ 1,200 ")).toBe(1200);
    expect(parseDecimal("2.5%")).toBe(2.5);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("12abc")).toBeNull();
    expect(parseDecimal("S$")).toBeNull();

    const parsed = parsePlanForm({ ...DEFAULT_PLAN_FORM, monthlyIncome: "S$6,000", cashSavings: "1,200" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.monthlyIncome).toBe(6000);
    expect(parsed.input.cashSavings).toBe(1200);
  });
});

describe("validation reasons", () => {
  it("classifies a blank, a bad format, and an impossible age", () => {
    expect(validateStep(0, { ...DEFAULT_PLAN_FORM, currentAge: "" })?.reason).toBe("missing");
    expect(validateStep(0, { ...DEFAULT_PLAN_FORM, retirementAge: "soon" })?.reason).toBe("format");
    expect(validateStep(0, { ...DEFAULT_PLAN_FORM, currentAge: "200" })?.reason).toBe("out-of-range");
    expect(validateStep(0, { ...DEFAULT_PLAN_FORM, currentAge: "35", retirementAge: "35" })?.reason).toBe(
      "out-of-range",
    );
    expect(validateStep(1, { ...DEFAULT_PLAN_FORM, monthlyIncome: "S$6,000" })).toBeNull();
  });
});

describe("years until retirement", () => {
  it("states the gap in years and flags an age that is not in the future", () => {
    expect(yearsUntilRetirementLine(35, 55)).toBe("That's 20 years from now.");
    expect(yearsUntilRetirementLine(35, 36)).toBe("That's 1 year from now.");
    expect(yearsUntilRetirementLine(35, 35)).toBe("That's the same as your age today.");
    expect(yearsUntilRetirementLine(35, 30)).toBe("That's 5 years before your age today.");
  });
});

describe("take-home pay", () => {
  it("uses CPF age bands, the wage ceiling, and the below-S$750 rule", () => {
    expect(takeHomePay({ includeCpf: true, currentAge: 35, monthlyIncome: 6_000 })).toBe(4_800);
    expect(
      takeHomeExcessSentence({
        includeCpf: true,
        currentAge: 35,
        monthlyIncome: 6_000,
        monthlyExpensesNow: 5_000,
      }),
    ).toBe("That's about S$200 more than your take-home pay of S$4,800.");
    expect(spendingExceedsTakeHome({ includeCpf: true, currentAge: 35, monthlyIncome: 6_000, monthlyExpensesNow: 4_800 })).toBe(
      false,
    );

    expect(takeHomePay({ includeCpf: true, currentAge: 35, monthlyIncome: 9_000 })).toBe(7_400);
    expect(takeHomePay({ includeCpf: true, currentAge: 35, monthlyIncome: 700 })).toBe(700);
    expect(takeHomePay({ includeCpf: true, currentAge: 57, monthlyIncome: 8_000 })).toBe(6_560);
    expect(takeHomePay({ includeCpf: false, currentAge: 35, monthlyIncome: 6_000 })).toBe(6_000);
    expect(
      spendingExceedsTakeHome({ includeCpf: false, currentAge: 35, monthlyIncome: 6_000, monthlyExpensesNow: 5_000 }),
    ).toBe(false);
  });
});

describe("spend less now", () => {
  it("searches today's spending and leaves the retirement-spending suggestion in place", () => {
    const shortfall = calculatePlan({ ...base, monthlyExpensesNow: 2_500 });
    expect(shortfall.canRetire).toBe(false);
    expect(shortfall.spendingCutNow).toBeCloseTo(500, 0);
    expect(shortfall.spendingCutToday).not.toBeNull();

    const fixed = calculatePlan({
      ...base,
      monthlyExpensesNow: 2_500 - (shortfall.spendingCutNow ?? 0),
    });
    expect(fixed.canRetire).toBe(true);
  });

  it("hides the suggestion when cutting today's spending cannot make the plan last", () => {
    const impossible = calculatePlan({
      ...base,
      monthlyIncome: 1_000,
      monthlyExpensesNow: 1_000,
      monthlyRetirementSpendingToday: 100_000,
      retirementAge: 41,
      lifeExpectancy: 50,
    });
    expect(impossible.canRetire).toBe(false);
    expect(impossible.spendingCutNow).toBeNull();
  });
});

describe("CPF LIFE in today's money", () => {
  it("names the payout year and deflates the flat amount by the user's inflation", () => {
    expect(cpfLifeDollarYear(35, 65)).toBe(2056);
    const today = cpfLifeInTodaysMoney({
      currentAge: 35,
      payoutAge: 65,
      annualInflation: 0.025,
      monthlyPayout: 3_462,
    });
    expect(today).toBeCloseTo(3_462 / 1.025 ** 30, 6);

    expect(
      cpfLifeInTodaysMoney({
        currentAge: 35,
        payoutAge: 65,
        annualInflation: 0,
        monthlyPayout: 3_462,
      }),
    ).toBe(3_462);

    expect(cpfLifeDollarYear(70, 65)).toBe(2026);
    expect(
      cpfLifeInTodaysMoney({
        currentAge: 70,
        payoutAge: 65,
        annualInflation: 0.025,
        monthlyPayout: 950,
      }),
    ).toBe(950);
  });
});

describe("skip versus continue", () => {
  it("names what the secondary button does and notices entries it would drop", () => {
    expect(skipLabel(2)).toBe("I don't have a home loan");
    expect(skipLabel(3)).toBe("Leave CPF out");
    expect(skipLabel(4)).toBe("No children to plan for");

    expect(stepWouldDiscardEntries(2, DEFAULT_PLAN_FORM)).toBe(false);
    expect(stepWouldDiscardEntries(2, { ...DEFAULT_PLAN_FORM, hasLoan: true })).toBe(true);
    expect(skipDiscardNote(2)).toBe("The home loan you entered won't be counted.");

    expect(stepWouldDiscardEntries(3, DEFAULT_PLAN_FORM)).toBe(false);
    expect(stepWouldDiscardEntries(3, { ...DEFAULT_PLAN_FORM, oa: "80000" })).toBe(true);
    expect(skipDiscardNote(3)).toBe("The CPF balances you entered won't be counted.");

    expect(stepWouldDiscardEntries(4, DEFAULT_PLAN_FORM)).toBe(false);
    expect(
      stepWouldDiscardEntries(4, {
        ...DEFAULT_PLAN_FORM,
        children: [{ id: "child-1", currentAge: "6", startAge: "19", years: "3", yearlyCostToday: "12000", path: "local" }],
      }),
    ).toBe(true);
    expect(skipDiscardNote(4)).toBe("The children you entered won't be counted.");
  });
});

describe("salary cap note", () => {
  it("adds the flat-ceiling sentence only when a projected salary rises above S$8,000", () => {
    expect(
      projectedSalaryExceedsCeiling({
        includeCpf: true,
        currentAge: 35,
        retirementAge: 55,
        monthlyIncome: 6_000,
        annualIncomeGrowth: 0.03,
      }),
    ).toBe(true);
    expect(
      projectedSalaryExceedsCeiling({
        includeCpf: true,
        currentAge: 40,
        retirementAge: 42,
        monthlyIncome: 8_000,
        annualIncomeGrowth: 0,
      }),
    ).toBe(false);
    expect(
      projectedSalaryExceedsCeiling({
        includeCpf: false,
        currentAge: 40,
        retirementAge: 42,
        monthlyIncome: 20_000,
        annualIncomeGrowth: 0,
      }),
    ).toBe(false);

    const above = calculatePlan({
      ...base,
      monthlyIncome: 9_000,
      monthlyExpensesNow: 1_000,
      includeCpf: true,
      cpf: { oa: 1_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
    });
    expect(above.salaryCapApplies).toBe(true);
    expect(estimateNotice(above)).toContain("The CPF salary cap after 2026 is assumed to stay at S$8,000.");

    const under = calculatePlan({
      ...base,
      monthlyIncome: 3_000,
      includeCpf: true,
      cpf: { oa: 1_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
    });
    expect(under.salaryCapApplies).toBe(false);
    expect(estimateNotice(under)).not.toContain("salary cap");

    const skipped = calculatePlan({ ...base, monthlyIncome: 9_000, includeCpf: false });
    expect(skipped.salaryCapApplies).toBe(false);
    expect(estimateNotice(skipped)).toBeNull();
  });
});
