import { describe, expect, it } from "vitest";
import {
  AUSTRALIA_UNIVERSITY,
  EDUCATION_ESTIMATE_CAVEAT,
  LOCAL_UNIVERSITY,
  UK_UNIVERSITY,
  US_PRIVATE_UNIVERSITY,
  US_PUBLIC_UNIVERSITY,
} from "../education/constants";
import {
  activePresetId,
  applyOverseasPreset,
  applyStudyChoice,
  editEducationFigure,
  educationStepAnalytics,
  educationTotalCopy,
  presetEstimateExplanation,
  pressEducationChoice,
  type EducationChildState,
} from "./education-choice";

function child(overrides: Partial<EducationChildState> = {}): EducationChildState {
  return {
    currentAge: "6",
    startAge: "19",
    years: "",
    yearlyCostToday: "",
    educationChoice: null,
    overseasPreset: null,
    presetEdited: false,
    ...overrides,
  };
}

describe("education cost presets", () => {
  it("fills each preset with the reference figures", () => {
    const local = applyStudyChoice(child(), "local");
    expect(local.educationChoice).toBe("local");
    expect(local.overseasPreset).toBeNull();
    expect(local.presetEdited).toBe(false);
    expect(local.yearlyCostToday).toBe("14300");
    expect(local.years).toBe("4");
    expect(LOCAL_UNIVERSITY.yearlyCostSgd).toBe(8_300 + 6_000);
    expect(LOCAL_UNIVERSITY.years).toBe(4);

    const overseas = applyStudyChoice(local, "overseas");
    expect(overseas.educationChoice).toBe("overseas");
    expect(overseas.overseasPreset).toBeNull();
    expect(overseas.yearlyCostToday).toBe("");
    expect(overseas.years).toBe("");

    const uk = applyOverseasPreset(overseas, "uk");
    expect(uk.yearlyCostToday).toBe("56200");
    expect(uk.years).toBe("3");
    expect(UK_UNIVERSITY.yearlyCostSgd).toBe(56_200);
    expect(UK_UNIVERSITY.years).toBe(3);

    const australia = applyOverseasPreset(overseas, "australia");
    expect(australia.yearlyCostToday).toBe("67400");
    expect(australia.years).toBe("3");
    expect(AUSTRALIA_UNIVERSITY.tuitionAud).toBe(45_000);
    expect(AUSTRALIA_UNIVERSITY.tuitionIsAssumption).toBe(true);
    expect(AUSTRALIA_UNIVERSITY.yearlyCostSgd).toBe(67_400);

    const usPublic = applyOverseasPreset(overseas, "us-public");
    expect(usPublic.yearlyCostToday).toBe("58800");
    expect(usPublic.years).toBe("4");
    expect(US_PUBLIC_UNIVERSITY.yearlyCostSgd).toBe(58_800);
    expect(US_PUBLIC_UNIVERSITY.years).toBe(4);

    const usPrivate = applyOverseasPreset(overseas, "us-private");
    expect(usPrivate.yearlyCostToday).toBe("78200");
    expect(usPrivate.years).toBe("4");
    expect(US_PRIVATE_UNIVERSITY.yearlyCostSgd).toBe(78_200);
    expect(US_PRIVATE_UNIVERSITY.years).toBe(4);
  });

  it("switches to Custom and drops the estimate when a figure is edited", () => {
    const local = applyStudyChoice(child(), "local");
    expect(activePresetId(local)).toBe("local");
    expect(presetEstimateExplanation("local")).toBe(EDUCATION_ESTIMATE_CAVEAT);
    expect(presetEstimateExplanation("uk")).toContain("Visa living-cost figures are minimums");
    expect(presetEstimateExplanation("uk")).toContain("Flights and insurance aren't included");
    expect(presetEstimateExplanation("australia")).toBe(
      `${EDUCATION_ESTIMATE_CAVEAT} Tuition is an assumption.`,
    );

    const editedCost = editEducationFigure(local, "yearlyCostToday", "15000");
    expect(editedCost.educationChoice).toBe("custom");
    expect(editedCost.overseasPreset).toBeNull();
    expect(editedCost.presetEdited).toBe(true);
    expect(editedCost.yearlyCostToday).toBe("15000");
    expect(editedCost.years).toBe("4");
    expect(activePresetId(editedCost)).toBeNull();

    const editedYears = editEducationFigure(applyOverseasPreset(child(), "uk"), "years", "4");
    expect(editedYears.educationChoice).toBe("custom");
    expect(editedYears.presetEdited).toBe(true);
    expect(editedYears.years).toBe("4");
    expect(editedYears.yearlyCostToday).toBe("56200");
    expect(activePresetId(editedYears)).toBeNull();

    const custom = applyStudyChoice(local, "custom");
    expect(custom.educationChoice).toBe("custom");
    expect(custom.presetEdited).toBe(false);
    expect(custom.yearlyCostToday).toBe("14300");
    expect(activePresetId(custom)).toBeNull();
  });

  it("states the total in today’s prices and the start year", () => {
    const local = applyStudyChoice(child(), "local");
    expect(educationTotalCopy(local)).toEqual({
      visible: "About S$57,200 in today’s prices, starting in 2039",
      accessible: "About 57,200 Singapore dollars in today’s prices, starting in 2039",
    });
    expect(educationTotalCopy(applyOverseasPreset(child(), "uk"))?.visible).toBe(
      "About S$168,600 in today’s prices, starting in 2039",
    );
    expect(educationTotalCopy(applyOverseasPreset(child(), "australia"))?.visible).toBe(
      "About S$202,200 in today’s prices, starting in 2039",
    );
    expect(educationTotalCopy(applyOverseasPreset(child(), "us-public"))?.visible).toBe(
      "About S$235,200 in today’s prices, starting in 2039",
    );
    expect(educationTotalCopy(applyOverseasPreset(child(), "us-private"))?.visible).toBe(
      "About S$312,800 in today’s prices, starting in 2039",
    );
    expect(educationTotalCopy(applyStudyChoice(child({ currentAge: "" }), "local"))?.visible).toBe(
      "About S$57,200 in today’s prices",
    );
    expect(educationTotalCopy(child())).toBeNull();
  });

  it("records education_choice and preset_edited without amounts", () => {
    expect(educationStepAnalytics([])).toEqual({ education_choice: "custom", preset_edited: "no" });
    expect(educationStepAnalytics([applyStudyChoice(child(), "local")])).toEqual({
      education_choice: "local",
      preset_edited: "no",
    });
    expect(educationStepAnalytics([applyOverseasPreset(child(), "australia")])).toEqual({
      education_choice: "overseas",
      preset_edited: "no",
    });
    const edited = editEducationFigure(applyStudyChoice(child(), "local"), "years", "5");
    expect(educationStepAnalytics([edited])).toEqual({ education_choice: "custom", preset_edited: "yes" });
    expect(
      educationStepAnalytics([
        applyStudyChoice(child(), "local"),
        applyOverseasPreset(child(), "uk"),
      ]),
    ).toEqual({ education_choice: "custom", preset_edited: "no" });
    expect(JSON.stringify(educationStepAnalytics([edited]))).not.toMatch(/14300|56200|67400|58800|78200|\d{5,}/);
  });

  it("ignores arrow keys and selects only on click, Enter, or Space", () => {
    for (const activation of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab"]) {
      expect(
        pressEducationChoice({ current: null, pressed: "local", activation }),
      ).toBeNull();
      expect(
        pressEducationChoice({ current: "uk", pressed: "australia", activation }),
      ).toBe("uk");
    }
    for (const activation of ["click", "Enter", " "]) {
      expect(pressEducationChoice({ current: null, pressed: "overseas", activation })).toBe("overseas");
      expect(pressEducationChoice({ current: "local", pressed: "custom", activation })).toBe("custom");
    }
  });
});
