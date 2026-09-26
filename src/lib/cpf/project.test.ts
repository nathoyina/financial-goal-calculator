import { describe, expect, it } from "vitest";
import { CPF_INTEREST } from "./constants";
import {
  closeSpecialAccount,
  estimateStandardPayout,
  extraInterestSlices,
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

  it("uses the 2027 senior rates and the 2027 allocation", () => {
    const senior = monthlyContributions(57, 8_000, 2027);
    expect(senior.total).toBe(Math.round(8_000 * 0.355));
    expect(senior.employee).toBe(Math.floor(8_000 * 0.19));
    expect(senior.employer).toBe(senior.total - senior.employee);
    expect(senior.allocation.ra).toBeCloseTo(senior.total * 0.3661, 6);
    expect(senior.allocation.ma).toBeCloseTo(senior.total * 0.2957, 6);
    expect(senior.allocation.sa).toBe(0);

    const younger = monthlyContributions(30, 8_000, 2027);
    expect(younger.total).toBe(Math.round(8_000 * 0.37));
    expect(younger.allocation.ma).toBeCloseTo(younger.total * 0.2162, 6);
    expect(younger.allocation.sa).toBeCloseTo(younger.total * 0.1621, 6);
  });

  it("applies deferral as 7% a year, capped at 35%, without compounding", () => {
    const result = projectCpf({
      currentAge: 65,
      months: 1,
      initial: { oa: 0, sa: 0, ra: 170_200, ma: 0 },
      wageAtMonth: () => 0,
      payoutAge: 70,
    });
    expect(result.monthlyPayout).toBeCloseTo(950 * 1.35, 6);
    expect(result.monthlyPayout).not.toBeCloseTo(950 * 1.07 ** 5, 0);
  });

  it("does not use the full-rate table at or below $750", () => {
    expect(monthlyContributions(30, 750).total).toBe(0);
    expect(monthlyContributions(30, 0).total).toBe(0);
  });

  it("credits interest at the end of December on the months so far, with OA extra interest to the SA", () => {
    const result = projectCpf({
      currentAge: 30,
      months: 12,
      initial: { oa: 10_000, sa: 0, ra: 0, ma: 0 },
      wageAtMonth: () => 0,
      payoutAge: 65,
    });
    expect(result.balances[2].oa).toBeCloseTo(10_000, 4);
    const december = result.balances[3];
    const monthsCredited = 4;
    expect(december.oa).toBeCloseTo(10_000 * (1 + (CPF_INTEREST.ordinaryAccount.value * monthsCredited) / 12), 4);
    expect(december.sa).toBeCloseTo((10_000 * CPF_INTEREST.extraBelow55.value * monthsCredited) / 12, 4);
    expect(result.balances[11].oa).toBeCloseTo(december.oa, 4);
    expect(december.ra).toBe(0);
  });

  it("does not spill MediSave above the 2026 cap once that cap is no longer published", () => {
    const result = projectCpf({
      currentAge: 40,
      months: 16,
      initial: { oa: 0, sa: 0, ra: 0, ma: 79_000 },
      wageAtMonth: () => 0,
      payoutAge: 65,
    });
    expect(result.balances[3].ma).toBeCloseTo(79_000, 0);
    expect(result.balances[15].ma).toBeGreaterThan(79_000);
    expect(result.bhsEstimated).toBe(true);
  });

  it("stops extra interest once Ordinary Account savings are withdrawn to cash", () => {
    const shared = {
      currentAge: 60,
      months: 4,
      initial: { oa: 500_000, sa: 0, ra: 0, ma: 0 },
      wageAtMonth: () => 0,
      payoutAge: 65,
    };
    const kept = projectCpf(shared);
    const swept = projectCpf({ ...shared, withdrawOaAtMonth: 0 });
    expect(swept.oaWithdrawn).toBeGreaterThan(100_000);
    expect(swept.balances[3].oa).toBeCloseTo(0, 4);
    expect(kept.balances[3].oa).toBeGreaterThan(swept.oaWithdrawn);
    const withdrawn = extraInterestSlices({ oa: 0, sa: 0, ra: 5_000, ma: 0 }, 60);
    const stillThere = extraInterestSlices({ oa: 20_000, sa: 0, ra: 5_000, ma: 0 }, 60);
    const oaExtra = (slices: ReturnType<typeof extraInterestSlices>) =>
      slices.reduce((sum, slice) => sum + slice.oa * slice.rate, 0);
    expect(oaExtra(withdrawn)).toBe(0);
    expect(oaExtra(stillThere)).toBeCloseTo(20_000 * 0.02, 6);
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

  it("includes this year's Ordinary Account interest in the sweep, once, and pays later interest to cash", () => {
    const initialOa = 120_000;
    const sweepAt = 2;
    const result = projectCpf({
      currentAge: 50,
      months: 8,
      initial: { oa: initialOa, sa: 0, ra: 0, ma: 40_000 },
      wageAtMonth: () => 0,
      payoutAge: 65,
      withdrawOaAtMonth: sweepAt,
    });

    const monthly = CPF_INTEREST.ordinaryAccount.value / 12;
    const extraMonthly = CPF_INTEREST.extraBelow55.value / 12;
    const oaInExtra = Math.min(initialOa, CPF_INTEREST.extraBelow55.ordinaryCap);
    let accrued = 0;
    let extra = 0;
    for (let month = 0; month < sweepAt; month += 1) {
      accrued += initialOa * monthly;
      extra += oaInExtra * extraMonthly;
    }

    expect(result.oaWithdrawn).toBeCloseTo(initialOa + accrued, 6);
    expect(result.balances.slice(sweepAt).every((balances) => balances.oa === 0)).toBe(true);
    const credited = result.postSweepOaCredits.reduce((sum, amount) => sum + amount, 0);
    expect(credited).toBeCloseTo(extra, 6);
    expect(result.postSweepOaCredits.slice(0, sweepAt).every((amount) => amount === 0)).toBe(true);
    expect(result.oaWithdrawn + credited).toBeCloseTo(initialOa + accrued + extra, 6);
    expect(result.balances.every((balances) => balances.ma > 30_000)).toBe(true);
    expect(result.oaWithdrawn).toBeLessThan(initialOa + accrued + 1_000);
  });

  it("keeps the Retirement Account at zero from the month CPF LIFE starts", () => {
    const result = projectCpf({
      currentAge: 64,
      months: 20,
      initial: { oa: 80_000, sa: 0, ra: 200_000, ma: 20_000 },
      wageAtMonth: () => 0,
      payoutAge: 65,
      withdrawOaAtMonth: 12,
    });
    expect(result.payoutStartMonth).not.toBeNull();
    const start = result.payoutStartMonth ?? 0;
    for (let month = start; month < result.balances.length; month += 1) {
      expect(result.balances[month].ra).toBe(0);
    }
    expect(result.balances[result.balances.length - 1].ma).toBeGreaterThan(20_000);
    expect(result.oaWithdrawn).toBeLessThan(80_000 + 10_000);
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
