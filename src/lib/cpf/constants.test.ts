import { describe, expect, it } from "vitest";
import {
  calendarYearAtMonth,
  cpfLifeDeferralMultiplier,
  ordinaryCeilingForYear,
  retirementSumsForCohort,
} from "./constants";
import { monthlyContributions } from "./project";

describe("CPF constants", () => {
  it("maps September 2026 to 2026 and January 2027 to 2027", () => {
    expect(calendarYearAtMonth(0)).toBe(2026);
    expect(calendarYearAtMonth(3)).toBe(2026);
    expect(calendarYearAtMonth(4)).toBe(2027);
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

    const early = retirementSumsForCohort(2024);
    expect(early.estimated).toBe(true);
    expect(early.yearUsed).toBe(2025);
    expect(early.brs).toBe(106_500);
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
