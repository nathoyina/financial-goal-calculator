import { describe, expect, it } from "vitest";
import {
  basicHealthcareSumCap,
  calendarYearAtMonth,
  cpfLifeDeferralMultiplier,
  isInterestCreditMonth,
  ordinaryCeilingForYear,
  retirementSumsForCohort,
} from "./constants";
import { monthlyContributions } from "./project";

describe("CPF constants", () => {
  it("maps September 2026 to 2026 and credits interest in December", () => {
    expect(calendarYearAtMonth(0)).toBe(2026);
    expect(calendarYearAtMonth(3)).toBe(2026);
    expect(calendarYearAtMonth(4)).toBe(2027);
    expect(isInterestCreditMonth(2)).toBe(false);
    expect(isInterestCreditMonth(3)).toBe(true);
    expect(isInterestCreditMonth(15)).toBe(true);
  });

  it("uses a published Basic Healthcare Sum and does not invent one after 2026", () => {
    expect(basicHealthcareSumCap({ calendarYear: 2026, age: 40, yearTurning65: 2051 }).cap).toBe(79_000);
    expect(basicHealthcareSumCap({ calendarYear: 2025, age: 66, yearTurning65: 2025 })).toEqual({
      cap: 75_500,
      estimated: false,
      yearUsed: 2025,
    });
    expect(basicHealthcareSumCap({ calendarYear: 2028, age: 40, yearTurning65: 2051 }).cap).toBeNull();
    const early = basicHealthcareSumCap({ calendarYear: 2026, age: 70, yearTurning65: 2021 });
    expect(early.estimated).toBe(true);
    expect(early.yearUsed).toBe(2022);
    expect(early.cap).toBe(66_000);
  });

  it("keeps published retirement sums exact and grows later cohorts as an assumption", () => {
    const y2027 = retirementSumsForCohort(2027);
    expect(y2027.estimated).toBe(false);
    expect(y2027.brs).toBe(114_100);
    expect(y2027.frs).toBe(228_200);
    expect(y2027.ers).toBe(456_400);

    const y2028 = retirementSumsForCohort(2028);
    expect(y2028.estimated).toBe(true);
    expect(y2028.brs).toBe(118_100);
    expect(y2028.frs).toBe(236_200);
    expect(y2028.ers).toBe(472_400);
    expect(y2028.ers).toBe(y2028.brs * 4);

    const y2021 = retirementSumsForCohort(2021);
    expect(y2021.estimated).toBe(false);
    expect(y2021.brs).toBe(93_000);
    expect(y2021.frs).toBe(186_000);
    expect(y2021.ers).toBe(279_000);

    const y2016 = retirementSumsForCohort(2016);
    expect(y2016.estimated).toBe(false);
    expect(y2016.brs).toBe(80_500);
    expect(y2016.ers).toBe(241_500);

    const early = retirementSumsForCohort(2015);
    expect(early.estimated).toBe(true);
    expect(early.yearUsed).toBe(2016);
    expect(early.brs).toBe(80_500);
  });

  it("caps deferral at 35% with simple interest", () => {
    expect(cpfLifeDeferralMultiplier(0)).toBe(1);
    expect(cpfLifeDeferralMultiplier(5)).toBeCloseTo(1.35, 8);
    expect(cpfLifeDeferralMultiplier(6)).toBeCloseTo(1.35, 8);
  });

  it("uses the 2025 ordinary wage ceiling before 2026", () => {
    expect(ordinaryCeilingForYear(2025)).toBe(7_400);
    expect(ordinaryCeilingForYear(2026)).toBe(8_000);
    expect(ordinaryCeilingForYear(2028)).toBe(8_000);
    expect(monthlyContributions(30, 8_000, 2025).total).toBe(Math.round(7_400 * 0.37));
  });
});
