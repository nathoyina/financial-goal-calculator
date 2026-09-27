import { describe, expect, it } from "vitest";
import {
  AUSTRALIA_UNIVERSITY,
  LOCAL_UNIVERSITY,
  UK_UNIVERSITY,
  US_PRIVATE_UNIVERSITY,
  US_PUBLIC_UNIVERSITY,
} from "../education/constants";
import {
  activePresetId,
  applyOverseasPreset,
  applyStudyChoice,
  blurEducationFigure,
  draftEducationFigure,
  educationStepAnalytics,
  educationTotalCopy,
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
    startedFrom: null,
    startedOverseas: null,
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

    const typing = draftEducationFigure(applyOverseasPreset(child(), "uk"), "yearlyCostToday", "60000");
    expect(typing.educationChoice).toBe("overseas");
    expect(typing.overseasPreset).toBe("uk");
    expect(typing.presetEdited).toBe(false);
    expect(activePresetId(typing)).toBe("uk");
    expect(educationTotalCopy(typing)?.visible).toBe("About S$180,000 in today’s prices, starting in 2039");

    const editedCost = blurEducationFigure(local, "yearlyCostToday", "15000");
    expect(editedCost.educationChoice).toBe("custom");
    expect(editedCost.overseasPreset).toBeNull();
    expect(editedCost.startedFrom).toBe("local");
    expect(editedCost.presetEdited).toBe(true);
    expect(editedCost.yearlyCostToday).toBe("15000");
    expect(editedCost.years).toBe("4");
    expect(activePresetId(editedCost)).toBeNull();

    const editedYears = blurEducationFigure(applyOverseasPreset(child(), "uk"), "years", "4");
    expect(editedYears.educationChoice).toBe("custom");
    expect(editedYears.startedFrom).toBe("overseas");
    expect(editedYears.startedOverseas).toBe("uk");
    expect(editedYears.presetEdited).toBe(true);
    expect(editedYears.years).toBe("4");
    expect(editedYears.yearlyCostToday).toBe("56200");
    expect(activePresetId(editedYears)).toBeNull();

    const unchanged = blurEducationFigure(applyOverseasPreset(child(), "uk"), "yearlyCostToday", "56200");
    expect(unchanged.educationChoice).toBe("overseas");
    expect(unchanged.overseasPreset).toBe("uk");
    expect(unchanged.presetEdited).toBe(false);
    expect(unchanged.startedFrom).toBe("overseas");

    const changedBack = blurEducationFigure(
      draftEducationFigure(applyOverseasPreset(child(), "uk"), "yearlyCostToday", "1"),
      "yearlyCostToday",
      "56200",
    );
    expect(changedBack.educationChoice).toBe("overseas");
    expect(changedBack.overseasPreset).toBe("uk");
    expect(changedBack.presetEdited).toBe(false);
    expect(changedBack.yearlyCostToday).toBe("56200");

    const custom = applyStudyChoice(local, "custom");
    expect(custom.educationChoice).toBe("custom");
    expect(custom.startedFrom).toBe("custom");
    expect(custom.startedOverseas).toBeNull();
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

  it("tracks the starting preset, not the Custom pill shown after an edit", () => {
    const editedLocal = blurEducationFigure(applyStudyChoice(child(), "local"), "yearlyCostToday", "15000");
    expect(editedLocal.educationChoice).toBe("custom");
    expect(educationStepAnalytics([editedLocal])).toEqual({
      children_count: 1,
      education_choice: ["local"],
      overseas_destination: ["none"],
      preset_edited: ["yes"],
    });

    const editedUk = blurEducationFigure(applyOverseasPreset(child(), "uk"), "years", "4");
    expect(editedUk.educationChoice).toBe("custom");
    expect(educationStepAnalytics([editedUk])).toEqual({
      children_count: 1,
      education_choice: ["overseas"],
      overseas_destination: ["uk"],
      preset_edited: ["yes"],
    });

    const custom = applyStudyChoice(child(), "custom");
    expect(educationStepAnalytics([custom])).toEqual({
      children_count: 1,
      education_choice: ["custom"],
      overseas_destination: ["none"],
      preset_edited: ["no"],
    });

    const australia = applyOverseasPreset(child(), "australia");
    expect(australia.presetEdited).toBe(false);
    expect(educationStepAnalytics([australia])).toEqual({
      children_count: 1,
      education_choice: ["overseas"],
      overseas_destination: ["australia"],
      preset_edited: ["no"],
    });

    const linedUp = educationStepAnalytics([editedLocal, applyOverseasPreset(child(), "uk")]);
    expect(linedUp).toEqual({
      children_count: 2,
      education_choice: ["local", "overseas"],
      overseas_destination: ["none", "uk"],
      preset_edited: ["yes", "no"],
    });
    expect(linedUp.education_choice).toHaveLength(linedUp.children_count);
    expect(linedUp.overseas_destination).toHaveLength(linedUp.children_count);
    expect(linedUp.preset_edited).toHaveLength(linedUp.children_count);
    expect(JSON.stringify(linedUp)).not.toMatch(/14300|56200|67400|58800|78200|\d{5,}/);
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
