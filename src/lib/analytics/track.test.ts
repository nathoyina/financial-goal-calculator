import { describe, expect, it } from "vitest";
import {
  clearTrackedEvents,
  gapBand,
  getTrackedEvents,
  retirementAgeBand,
  track,
  verdictAnalyticsProps,
} from "./track";

describe("analytics", () => {
  it("records events locally and does not include raw money amounts", () => {
    clearTrackedEvents();
    track("Landing Viewed");
    track(
      "Verdict Viewed",
      verdictAnalyticsProps({
        outcome: "shortfall",
        gap: -220_000,
        retirementAge: 40,
        hasHousingLoan: true,
        hasChildren: false,
        reliesOnEstimate: true,
      }),
    );
    const verdict = getTrackedEvents()[1];
    expect(verdict.event).toBe("Verdict Viewed");
    expect(verdict.props).toEqual({
      outcome: "shortfall",
      gap_band: "100k-to-500k",
      retirement_age_band: "under-50",
      has_housing_loan: true,
      has_children: false,
      relies_on_estimate: true,
    });
    expect(JSON.stringify(verdict.props)).not.toMatch(/220000|salary|balance|instalment/i);
    expect(verdict.props.relies_on_estimate).toBe(true);

    track("Estimate Info Opened", { figure: "Retirement sum" });
    const opened = getTrackedEvents().at(-1);
    expect(opened?.event).toBe("Estimate Info Opened");
    expect(opened?.props).toEqual({ figure: "Retirement sum" });
    expect(JSON.stringify(opened?.props)).not.toMatch(/\d{4,}|salary|balance/);
  });

  it("bands retirement ages and gaps", () => {
    expect(retirementAgeBand(40)).toBe("under-50");
    expect(retirementAgeBand(62)).toBe("60-64");
    expect(retirementAgeBand(75)).toBe("70-plus");
    expect(gapBand(0)).toBe("none");
    expect(gapBand(80_000)).toBe("under-100k");
    expect(gapBand(-600_000)).toBe("over-500k");
  });
});
