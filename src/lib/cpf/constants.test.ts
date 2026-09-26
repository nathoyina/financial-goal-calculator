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

  it("uses official cohort sums, labels 2021 and pre-2017, and keeps the 2026 Enhanced Retirement Sum", () => {
    const y2017 = retirementSumsForCohort(2017);
    expect(y2017.estimated).toBe(false);
    expect(y2017.brs).toBe(83_000);
    expect(y2017.frs).toBe(166_000);
    expect(y2017.ers).toBe(440_800);
    expect(y2017.ers).not.toBe(y2017.brs * 4);

    const y2020 = retirementSumsForCohort(2020);
    expect(y2020.estimated).toBe(false);
    expect(y2020.brs).toBe(90_500);
    expect(y2020.frs).toBe(181_000);
    expect(y2020.ers).toBe(440_800);

    const y2021 = retirementSumsForCohort(2021);
    expect(y2021.estimated).toBe(true);
    expect(y2021.yearUsed).toBe(2021);
    expect(y2021.brs).toBe(93_000);
    expect(y2021.frs).toBe(186_000);
    expect(y2021.ers).toBe(440_800);

    const y2022 = retirementSumsForCohort(2022);
    expect(y2022.estimated).toBe(false);
    expect(y2022.brs).toBe(96_000);
    expect(y2022.frs).toBe(192_000);

    const y2024 = retirementSumsForCohort(2024);
    expect(y2024.estimated).toBe(false);
    expect(y2024.brs).toBe(102_900);
    expect(y2024.frs).toBe(205_800);
    expect(y2024.ers).toBe(440_800);

    const before = retirementSumsForCohort(2016);
    expect(before.estimated).toBe(true);
    expect(before.yearUsed).toBe(2017);
    expect(before.brs).toBe(83_000);
    expect(before.frs).toBe(166_000);
    expect(before.ers).toBe(440_800);

    const y2027 = retirementSumsForCohort(2027);
    expect(y2027.estimated).toBe(false);
    expect(y2027.brs).toBe(114_100);
    expect(y2027.frs).toBe(228_200);
    expect(y2027.ers).toBe(440_800);

    const y2028 = retirementSumsForCohort(2028);
    expect(y2028.estimated).toBe(true);
    expect(y2028.brs).toBe(118_100);
    expect(y2028.frs).toBe(236_200);
    expect(y2028.ers).toBe(440_800);
    expect(y2028.ers).not.toBe(y2028.brs * 4);
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
