import { describe, expect, it } from "vitest";
import {
  clearTrackedEvents,
  gapBand,
  getTrackedEvents,
  retirementAgeBand,
  shouldTrackAdjustmentAfterVerdict,
  stepCompletedProps,
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
        hasCpf: false,
        hasChildren: false,
        reliesOnEstimate: true,
        isFirstVerdict: true,
        spendingExceedsTakeHome: true,
      }),
    );
    const verdict = getTrackedEvents()[1];
    expect(verdict.event).toBe("Verdict Viewed");
    expect(verdict.props).toEqual({
      outcome: "shortfall",
      gap_band: "100k-to-500k",
      retirement_age_band: "under-50",
      has_housing_loan: true,
      has_cpf: false,
      has_children: false,
      relies_on_estimate: true,
      is_first_verdict: true,
      spending_exceeds_take_home: true,
    });
    expect(verdictAnalyticsProps({
      outcome: "on-track",
      gap: 0,
      retirementAge: 65,
      hasHousingLoan: false,
      hasCpf: true,
      hasChildren: false,
      reliesOnEstimate: false,
      isFirstVerdict: false,
      spendingExceedsTakeHome: false,
    }).is_first_verdict).toBe(false);
    expect(stepCompletedProps("retirement age")).toEqual({ step: "retirement age" });
    expect(stepCompletedProps("housing loan", "no")).toEqual({ step: "housing loan", answer: "no" });
    expect(stepCompletedProps("CPF", "yes")).toEqual({ step: "CPF", answer: "yes" });
    expect(stepCompletedProps("education", "no")).toEqual({ step: "education", answer: "no" });
    expect(
      stepCompletedProps("education", "yes", {
        education_choice: "overseas",
        overseas_destination: "uk",
        preset_edited: "yes",
      }),
    ).toEqual({
      step: "education",
      answer: "yes",
      education_choice: "overseas",
      overseas_destination: "uk",
      preset_edited: "yes",
    });
    const localEdited = stepCompletedProps("education", "yes", {
      education_choice: "local",
      preset_edited: "yes",
    });
    expect(localEdited).toEqual({
      step: "education",
      answer: "yes",
      education_choice: "local",
      preset_edited: "yes",
    });
    expect(localEdited).not.toHaveProperty("overseas_destination");
    expect(JSON.stringify(localEdited)).not.toMatch(/\d{4,}|salary|balance|14300|56200/);
    expect(JSON.stringify(getTrackedEvents())).not.toMatch(/Step Skipped/);
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

  it("fires an adjustment once per verdict, then again after the next verdict", () => {
    expect(
      shouldTrackAdjustmentAfterVerdict({
        verdictSeen: true,
        alreadyTrackedForThisVerdict: false,
        source: "user",
      }),
    ).toBe(true);
    expect(
      shouldTrackAdjustmentAfterVerdict({
        verdictSeen: true,
        alreadyTrackedForThisVerdict: true,
        source: "user",
      }),
    ).toBe(false);
    expect(
      shouldTrackAdjustmentAfterVerdict({
        verdictSeen: true,
        alreadyTrackedForThisVerdict: false,
        source: "suggestion",
      }),
    ).toBe(false);
    expect(
      shouldTrackAdjustmentAfterVerdict({
        verdictSeen: false,
        alreadyTrackedForThisVerdict: false,
        source: "user",
      }),
    ).toBe(false);
  });
});
