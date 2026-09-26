import { describe, expect, it } from "vitest";
import { amortisationSchedule, levelInstalment } from "./loan";

describe("loan amortisation", () => {
  it("splits a zero-interest balance into equal instalments", () => {
    const payment = levelInstalment(12_000, 0, 12);
    expect(payment).toBe(1_000);
    const schedule = amortisationSchedule({
      balance: 12_000,
      annualInterestRate: 0,
      remainingMonths: 12,
    });
    expect(schedule).toHaveLength(12);
    expect(schedule[0].payment).toBe(1_000);
    expect(schedule[0].interest).toBe(0);
    expect(schedule.at(-1)?.balance).toBeCloseTo(0, 6);
    expect(schedule[12]).toBeUndefined();
  });

  it("matches the monthly-rest level-payment formula", () => {
    const principal = 100_000;
    const annual = 0.06;
    const months = 12;
    const monthly = annual / 12;
    const expected = (principal * monthly) / (1 - (1 + monthly) ** -months);
    expect(levelInstalment(principal, annual, months)).toBeCloseTo(expected, 8);

    const schedule = amortisationSchedule({
      balance: principal,
      annualInterestRate: annual,
      remainingMonths: months,
    });
    expect(schedule[0].interest).toBeCloseTo(principal * monthly, 6);
    expect(schedule.at(-1)?.balance).toBeCloseTo(0, 2);
    expect(schedule.reduce((sum, row) => sum + row.principal, 0)).toBeCloseTo(principal, 2);
  });

  it("uses a typed-in instalment and stops when the balance is gone", () => {
    const schedule = amortisationSchedule({
      balance: 1_000,
      annualInterestRate: 0,
      remainingMonths: 40,
      monthlyInstalment: 400,
    });
    expect(schedule.map((row) => row.payment)).toEqual([400, 400, 200]);
    expect(schedule.at(-1)?.balance).toBe(0);
  });
});
