import { describe, expect, it } from "vitest";
import { CPF_INTEREST } from "./constants";
import {
  closeSpecialAccount,
  estimateStandardPayout,
  monthlyContributions,
  projectCpf,
} from "./project";

describe("CPF projection", () => {
  it("rounds 2026 contributions for a wage at the ceiling", () => {
    const result = monthlyContributions(30, 8_000);
    expect(result.total).toBe(Math.round(8_000 * 0.37));
    expect(result.employee).toBe(Math.floor(8_000 * 0.2));
    expect(result.employer).toBe(result.total - result.employee);
    expect(result.allocation.ma).toBeCloseTo(result.total * 0.2162, 6);
    expect(result.allocation.sa).toBeCloseTo(result.total * 0.1621, 6);
    expect(result.allocation.oa + result.allocation.sa + result.allocation.ma).toBeCloseTo(result.total, 6);
  });

  it("does not use the full-rate table at or below $750", () => {
    expect(monthlyContributions(30, 750).total).toBe(0);
    expect(monthlyContributions(30, 0).total).toBe(0);
  });

  it("credits interest once a year on each month's balance, with OA extra interest to the SA", () => {
    const result = projectCpf({
      currentAge: 30,
      months: 12,
      initial: { oa: 10_000, sa: 0, ra: 0, ma: 0 },
      wageAtMonth: () => 0,
      payoutAge: 65,
    });
    const end = result.balances[11];
    expect(end.oa).toBeCloseTo(10_000 * (1 + CPF_INTEREST.ordinaryAccount.value), 4);
    expect(end.sa).toBeCloseTo(10_000 * CPF_INTEREST.extraBelow55.value, 4);
    expect(end.ra).toBe(0);
  });

  it("closes the Special Account at 55 into the RA up to the FRS, with the excess to the OA", () => {
    const sums = 220_400;
    const rich = closeSpecialAccount({ oa: 10_000, sa: 300_000, ra: 0, ma: 0 }, sums);
    expect(rich.sa).toBe(0);
    expect(rich.ra).toBe(sums);
    expect(rich.oa).toBe(10_000 + 300_000 - sums);

    const mixed = closeSpecialAccount({ oa: 200_000, sa: 50_000, ra: 0, ma: 0 }, sums);
    expect(mixed.sa).toBe(0);
    expect(mixed.ra).toBe(sums);
    expect(mixed.oa).toBe(200_000 - (sums - 50_000));
  });

  it("estimates a Standard payout from the published anchors", () => {
    expect(estimateStandardPayout(0)).toBe(0);
    expect(estimateStandardPayout(170_200)).toBeCloseTo(950, 6);
    expect(estimateStandardPayout(330_100)).toBeCloseTo(1_780, 6);
    expect(estimateStandardPayout(85_100)).toBeCloseTo(475, 6);
  });

  it("estimates CPF LIFE for a member who is already past 65", () => {
    const result = projectCpf({
      currentAge: 70,
      months: 1,
      initial: { oa: 0, sa: 0, ra: 170_200, ma: 0 },
      wageAtMonth: () => 0,
      payoutAge: 65,
    });
    expect(result.monthlyPayout).toBeCloseTo(950, 6);
    expect(result.payoutStartMonth).toBe(0);
    expect(result.balances[0].ra).toBe(0);
  });

  it("lets an OA housing payment reduce OA, and reports what OA cannot cover", () => {
    const result = projectCpf({
      currentAge: 40,
      months: 1,
      initial: { oa: 100, sa: 0, ra: 0, ma: 0 },
      wageAtMonth: () => 0,
      oaPaymentAtMonth: () => 250,
      payoutAge: 65,
    });
    expect(result.balances[0].oa).toBeCloseTo(0, 4);
    expect(result.oaShortfall[0]).toBe(150);
  });
});
