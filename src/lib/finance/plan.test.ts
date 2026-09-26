import { describe, expect, it } from "vitest";
import { calculatePlan, estimateNotice, type PlanInput } from "./plan";

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

describe("retirement plan", () => {
  it("accepts early and late retirement ages", () => {
    expect(calculatePlan({ ...base, currentAge: 35, retirementAge: 40, lifeExpectancy: 90 }).valid).toBe(true);
    expect(calculatePlan({ ...base, currentAge: 70, retirementAge: 75, lifeExpectancy: 90 }).valid).toBe(true);
    const sameAge = calculatePlan({ ...base, retirementAge: 40 });
    expect(sameAge.valid).toBe(false);
    expect(sameAge.errors[0]).toMatch(/after your current age/i);
  });

  it("saves income minus expenses and can fund a matching retirement spend", () => {
    const result = calculatePlan(base);
    expect(result.monthlySavingToday).toBe(1_000);
    expect(result.projectedCashAtRetirement).toBeCloseTo(24_000, 4);
    expect(result.nestEggNeeded).toBeCloseTo(24_000, 4);
    expect(result.canRetire).toBe(true);
    expect(result.gap).toBeCloseTo(0, 4);
    expect(result.extraMonthlySaving).toBe(0);
    expect(result.moneyRunsOutAge).toBeNull();
  });

  it("names the extra saving, spending cut, and earliest age when the plan falls short", () => {
    const result = calculatePlan({ ...base, monthlyRetirementSpendingToday: 2_000 });
    expect(result.canRetire).toBe(false);
    expect(result.extraMonthlySaving).toBeCloseTo(1_000, 0);
    expect(result.spendingCutToday).toBeCloseTo(1_000, 0);
    expect(result.earliestRetirementAge).toBe(43);
    expect(result.moneyRunsOutAge).not.toBeNull();
  });

  it("lets a cash loan reduce what can be saved, and an OA loan does not", () => {
    const cashLoan = calculatePlan({
      ...base,
      loan: {
        balance: 12_000,
        annualInterestRate: 0,
        remainingMonths: 12,
        paidFrom: "cash",
      },
    });
    expect(cashLoan.monthlySavingToday).toBe(0);
    expect(cashLoan.projectedCashAtRetirement).toBeCloseTo(12_000, 4);

    const withCpf = calculatePlan({
      ...base,
      includeCpf: true,
      cpf: { oa: 50_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
    });
    const oaLoan = calculatePlan({
      ...base,
      includeCpf: true,
      cpf: { oa: 50_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
      loan: {
        balance: 12_000,
        annualInterestRate: 0,
        remainingMonths: 12,
        paidFrom: "oa",
      },
    });
    expect(oaLoan.monthlySavingToday).toBeCloseTo(withCpf.monthlySavingToday, 4);
    expect(oaLoan.monthlySavingToday).toBeGreaterThan(cashLoan.monthlySavingToday);
    expect(oaLoan.reliesOnEstimate).toBe(true);
  });

  it("takes education costs out of cash", () => {
    const result = calculatePlan({
      ...base,
      monthlyIncome: 0,
      monthlyExpensesNow: 0,
      monthlyRetirementSpendingToday: 0,
      cashSavings: 8_000,
      retirementAge: 42,
      children: [{ currentAge: 18, startAge: 19, years: 1, yearlyCostToday: 5_000 }],
    });
    expect(result.projectedCashAtRetirement).toBeCloseTo(3_000, 4);
    expect(result.canRetire).toBe(true);
  });

  it("counts an Ordinary Account sweep once, in projected cash", () => {
    const result = calculatePlan({
      currentAge: 54,
      retirementAge: 65,
      lifeExpectancy: 66,
      cashSavings: 0,
      monthlyIncome: 0,
      annualIncomeGrowth: 0,
      monthlyExpensesNow: 0,
      monthlyRetirementSpendingToday: 10_000,
      annualReturn: 0,
      annualInflation: 0,
      extraMonthlySaving: 0,
      includeCpf: true,
      cpf: { oa: 400_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
      loan: null,
      children: [],
    });
    expect(result.valid).toBe(true);
    expect(result.projectedCashAtRetirement).toBeGreaterThan(0);
    expect(result.nestEggNeeded).toBeGreaterThan(20_000);
    expect(result.gap).toBeCloseTo(result.projectedCashAtRetirement - result.nestEggNeeded, 4);
  });

  it("keeps CPF LIFE that starts before a late retirement", () => {
    const result = calculatePlan({
      currentAge: 70,
      retirementAge: 75,
      lifeExpectancy: 77,
      cashSavings: 0,
      monthlyIncome: 0,
      annualIncomeGrowth: 0,
      monthlyExpensesNow: 0,
      monthlyRetirementSpendingToday: 2_000,
      annualReturn: 0,
      annualInflation: 0,
      extraMonthlySaving: 0,
      includeCpf: true,
      cpf: { oa: 0, sa: 0, ra: 170_200, ma: 0, payoutAge: 65 },
      loan: null,
      children: [],
    });
    expect(result.valid).toBe(true);
    expect(result.cpfLifeMonthly).toBeCloseTo(950, 6);
    expect(result.projectedCashAtRetirement).toBeCloseTo(950 * 12 * 5, 0);
    expect(result.canRetire).toBe(true);
  });

  it("labels retirement sums after 2027 as estimates", () => {
    const young = calculatePlan({
      ...base,
      currentAge: 35,
      retirementAge: 65,
      lifeExpectancy: 90,
      includeCpf: true,
      cpf: { oa: 10_000, sa: 5_000, ra: 0, ma: 0, payoutAge: 65 },
    });
    expect(young.cohortYear).toBeGreaterThan(2027);
    expect(young.retirementSumEstimated).toBe(true);
    expect(young.estimates.some((note) => note.id === "retirement-sum")).toBe(true);
    expect(young.estimates.find((note) => note.id === "retirement-sum")?.explanation).toMatch(/Assumption/);
    expect(young.estimates.some((note) => note.id === "cpf-life-payout")).toBe(true);
    expect(young.estimates.find((note) => note.id === "cpf-life-payout")?.explanation).toMatch(/2026 cohort ranges/);
    expect(young.estimates.some((note) => note.id === "escalating-plan-start")).toBe(true);
    expect(young.estimates.some((note) => note.id === "housing-accrued-interest")).toBe(true);
    expect(estimateNotice(young)).toMatch(/depends on an estimate/);
    expect(estimateNotice(young)).toMatch(/retirement sum after 2027 is an assumption/);
    expect(estimateNotice(young)).toMatch(/2026 CPF LIFE payout ranges/);
    expect(estimateNotice(young)).toMatch(/Basic Healthcare Sum after 2026/);
    expect(estimateNotice(young)).not.toMatch(/Escalating/);
    expect(estimateNotice(young)).not.toMatch(/accrued-interest/);

    const published = calculatePlan({
      ...base,
      currentAge: 55,
      retirementAge: 65,
      lifeExpectancy: 90,
      includeCpf: true,
      cpf: { oa: 10_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
    });
    expect(published.cohortYear).toBe(2026);
    expect(published.retirementSumEstimated).toBe(false);
    expect(estimateNotice(published)).not.toMatch(/after 2027/);
    expect(estimateNotice(calculatePlan(base))).toBeNull();
  });
});
