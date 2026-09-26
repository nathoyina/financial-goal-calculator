import { describe, expect, it } from "vitest";
import { educationWithdrawals } from "./education";

describe("education costs", () => {
  it("takes a lump sum when the child reaches the start age", () => {
    const items = educationWithdrawals({
      children: [{ currentAge: 10, startAge: 19, years: 1, yearlyCostToday: 10_000 }],
      annualInflation: 0,
      horizonMonths: 30 * 12,
    });
    expect(items).toEqual([{ month: 9 * 12, amount: 10_000, childIndex: 0 }]);
  });

  it("inflates each study year from today", () => {
    const items = educationWithdrawals({
      children: [{ currentAge: 17, startAge: 19, years: 2, yearlyCostToday: 20_000 }],
      annualInflation: 0.1,
      horizonMonths: 10 * 12,
    });
    expect(items[0].amount).toBeCloseTo(20_000 * 1.1 ** 2, 6);
    expect(items[1].month).toBe(3 * 12);
    expect(items[1].amount).toBeCloseTo(20_000 * 1.1 ** 3, 6);
  });

  it("ignores study years that have already started", () => {
    const items = educationWithdrawals({
      children: [{ currentAge: 20, startAge: 19, years: 3, yearlyCostToday: 5_000 }],
      annualInflation: 0,
      horizonMonths: 40 * 12,
    });
    expect(items.map((item) => item.month)).toEqual([0, 12]);
  });
});
