import { describe, expect, it } from "vitest";
import { monthlyRate, realAnnualReturn } from "./rates";
import {
  calculateRetirement,
  extraMonthlyContribution,
  futureValue,
  nestEggForWithdrawals,
  type RetirementInput,
} from "./retirement";

const base: RetirementInput = {
  currentAge: 40,
  retirementAge: 40.25,
  lifeExpectancy: 40.5,
  currentSavings: 1000,
  monthlyContribution: 100,
  annualReturn: 1.01 ** 12 - 1,
  annualInflation: 1.02 ** 12 - 1,
  monthlySpendingToday: 200,
  monthlyRetirementIncomeToday: 50,
};

describe("rate helpers", () => {
  it("turns an annual effective rate into the matching monthly rate", () => {
    expect(monthlyRate(0)).toBe(0);
    expect(monthlyRate(1.005 ** 12 - 1)).toBeCloseTo(0.005, 12);
    expect(realAnnualReturn(0.05, 0.025)).toBeCloseTo(1.05 / 1.025 - 1, 12);
  });
});

describe("future value and nest egg building blocks", () => {
  it("compounds a lump sum to the annual effective return over 12 months", () => {
    expect(
      futureValue({
        startingBalance: 1000,
        monthlyContribution: 0,
        monthlyReturn: monthlyRate(0.05),
        months: 12,
      }),
    ).toBeCloseTo(1050, 8);
  });

  it("adds month-end contributions at a 1% monthly return", () => {
    expect(
      futureValue({
        startingBalance: 1000,
        monthlyContribution: 100,
        monthlyReturn: 0.01,
        months: 2,
      }),
    ).toBeCloseTo(1221.1, 8);
  });

  it("prices a two-month growing withdrawal", () => {
    // Month 0 withdraws 100, month 1 withdraws 102. Solved backwards at 1% a month.
    expect(
      nestEggForWithdrawals({
        firstNetWithdrawal: 100,
        monthlyReturn: 0.01,
        monthlyGrowth: 1.02,
        months: 2,
      }),
    ).toBeCloseTo(100 + 102 / 1.01, 8);
  });

  it("solves the extra contribution that funds a known shortfall", () => {
    expect(extraMonthlyContribution({ shortfall: 0, monthlyReturn: 0.01, months: 24 })).toBe(0);
    expect(extraMonthlyContribution({ shortfall: 500, monthlyReturn: 0, months: 10 })).toBe(50);
    expect(extraMonthlyContribution({ shortfall: 500, monthlyReturn: 0.01, months: 0 })).toBeNull();
    const monthly = extraMonthlyContribution({ shortfall: 201, monthlyReturn: 0.01, months: 2 });
    expect(monthly).toBeCloseTo(100, 8);
  });
});

describe("calculateRetirement", () => {
  it("plans a normal case with return, inflation, contributions, and income", () => {
    const result = calculateRetirement(base);

    // Three month-end contributions of 100 on 1,000 at 1% a month.
    expect(result.valid).toBe(true);
    expect(result.projectedSavings).toBeCloseTo(1333.311, 3);

    // Spending scales by 1.02^3 before retirement. CPF LIFE stays at the flat dollar amount.
    expect(result.monthlySpendingAtRetirement).toBeCloseTo(200 * 1.02 ** 3, 6);
    expect(result.monthlyIncomeAtRetirement).toBeCloseTo(50, 6);

    const spend0 = 200 * 1.02 ** 3;
    const withdrawal = (month: number) => spend0 * 1.02 ** month - 50;
    const nest = withdrawal(0) + withdrawal(1) / 1.01 + withdrawal(2) / 1.01 ** 2;
    expect(result.nestEggNeeded).toBeCloseTo(nest, 6);
    expect(result.gap).toBeCloseTo(1333.311 - nest, 3);
    expect(result.extraMonthlySaving).toBe(0);
    expect(result.moneyRunsOutAge).toBeNull();
    expect(result.series[0]).toMatchObject({ age: 40, balance: 1000, phase: "accumulation" });
    expect(result.series.at(-1)?.balance).toBeGreaterThan(0);
    expect(result.series.every((point, index) => index === 0 || point.age >= result.series[index - 1].age)).toBe(
      true,
    );
  });

  it("uses straight sums when return and inflation are both zero", () => {
    const result = calculateRetirement({
      currentAge: 40,
      retirementAge: 50,
      lifeExpectancy: 60,
      currentSavings: 10_000,
      monthlyContribution: 500,
      annualReturn: 0,
      annualInflation: 0,
      monthlySpendingToday: 2000,
      monthlyRetirementIncomeToday: 500,
    });

    expect(result.projectedSavings).toBe(10_000 + 500 * 120);
    expect(result.nestEggNeeded).toBe(1500 * 120);
    expect(result.gap).toBe(70_000 - 180_000);
    expect(result.extraMonthlySaving).toBeCloseTo(110_000 / 120, 8);
    expect(result.nestEggInTodaysMoney).toBe(result.nestEggNeeded);

    // 70,000 covers 46 full withdrawals of 1,500 and two thirds of the next one.
    expect(result.moneyRunsOutAge).toBeCloseTo(40 + 10 + (46 + 2 / 3) / 12, 8);
    expect(result.endingBalance).toBe(0);
    expect(result.series.at(-1)).toMatchObject({ balance: 0, phase: "drawdown" });
    expect(result.series.every((point) => point.balance >= 0)).toBe(true);
  });

  it("treats someone already retired as drawing down from today", () => {
    const result = calculateRetirement({
      currentAge: 70,
      retirementAge: 65,
      lifeExpectancy: 80,
      currentSavings: 50_000,
      monthlyContribution: 9_999,
      annualReturn: 0,
      annualInflation: 0,
      monthlySpendingToday: 1_000,
      monthlyRetirementIncomeToday: 0,
    });

    expect(result.yearsToRetirement).toBe(0);
    expect(result.yearsInRetirement).toBe(10);
    expect(result.projectedSavings).toBe(50_000);
    expect(result.nestEggNeeded).toBe(1_000 * 120);
    expect(result.gap).toBe(50_000 - 120_000);
    expect(result.extraMonthlySaving).toBeNull();
    expect(result.monthlySpendingAtRetirement).toBe(1_000);
    expect(result.moneyRunsOutAge).toBeCloseTo(70 + 50 / 12, 8);
  });

  it("draws a solved nest egg down to about zero", () => {
    const preview = calculateRetirement({
      currentAge: 65,
      retirementAge: 65,
      lifeExpectancy: 90,
      currentSavings: 0,
      monthlyContribution: 2_000,
      annualReturn: 0.05,
      annualInflation: 0.025,
      monthlySpendingToday: 4_000,
      monthlyRetirementIncomeToday: 800,
    });

    const funded = calculateRetirement({
      currentAge: 65,
      retirementAge: 65,
      lifeExpectancy: 90,
      currentSavings: preview.nestEggNeeded,
      monthlyContribution: 2_000,
      annualReturn: 0.05,
      annualInflation: 0.025,
      monthlySpendingToday: 4_000,
      monthlyRetirementIncomeToday: 800,
    });

    expect(preview.extraMonthlySaving).toBeNull();
    expect(funded.gap).toBeCloseTo(0, 2);
    expect(funded.extraMonthlySaving).toBe(0);
    expect(funded.endingBalance).toBeCloseTo(0, 2);
    expect(funded.moneyRunsOutAge).toBeNull();
    expect(funded.projectedSavings).toBeCloseTo(preview.nestEggNeeded, 6);
  });

  it("needs no nest egg when retirement income covers spending", () => {
    const result = calculateRetirement({
      currentAge: 65,
      retirementAge: 65,
      lifeExpectancy: 66,
      currentSavings: 0,
      monthlyContribution: 0,
      annualReturn: 0,
      annualInflation: 0,
      monthlySpendingToday: 100,
      monthlyRetirementIncomeToday: 150,
    });

    expect(result.nestEggNeeded).toBe(0);
    expect(result.gap).toBe(0);
    expect(result.endingBalance).toBeCloseTo(50 * 12, 6);
    expect(result.moneyRunsOutAge).toBeNull();
  });

  it("rejects a horizon that ends before retirement, and a return of −100%", () => {
    const tooShort = calculateRetirement({
      ...base,
      currentAge: 40,
      retirementAge: 70,
      lifeExpectancy: 60,
    });
    expect(tooShort.valid).toBe(false);
    expect(tooShort.errors[0]).toMatch(/life expectancy/i);

    const badReturn = calculateRetirement({ ...base, annualReturn: -1 });
    expect(badReturn.valid).toBe(false);
    expect(badReturn.series).toEqual([]);

    const negativeSavings = calculateRetirement({ ...base, currentSavings: -1 });
    expect(negativeSavings.valid).toBe(false);
  });
});
