import { calendarYearAtMonth } from "../cpf/constants";
import {
  AUSTRALIA_TUITION_ASSUMPTION_NOTE,
  EDUCATION_ESTIMATE_CAVEAT,
  EDUCATION_PRESETS,
  type EducationPresetId,
} from "../education/constants";
import { formatMoney } from "./format";
import { parseDecimal } from "./parse";

export type EducationChoice = "local" | "overseas" | "custom";
export type OverseasPresetId = "uk" | "australia" | "us-public" | "us-private";

export interface EducationChildState {
  currentAge: string;
  startAge: string;
  years: string;
  yearlyCostToday: string;
  /** Null until Local, Overseas, or Custom is pressed. */
  educationChoice: EducationChoice | null;
  /** Null until a country is pressed. Cleared when the screen leaves Overseas. */
  overseasPreset: OverseasPresetId | null;
  /**
   * Preset the person started from. Custom only if they pressed Custom.
   * An edit does not change this, even though the screen then shows Custom.
   */
  startedFrom: EducationChoice | null;
  /** Kept after an edit hides the country row. Set only when startedFrom is overseas. */
  startedOverseas: OverseasPresetId | null;
  /** True after the yearly cost or the years were edited away from a preset. */
  presetEdited: boolean;
}

const ARROW_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
const CHOICE_KEYS = new Set(["click", "Enter", " ", "Spacebar"]);

/**
 * Buttons, not a radiogroup. Arrow keys leave the current choice alone.
 * Click, Enter, and Space select the pressed pill.
 */
export function pressEducationChoice<T extends string>(input: {
  current: T | null;
  pressed: T;
  activation: string;
}): T | null {
  if (ARROW_KEYS.has(input.activation) || !CHOICE_KEYS.has(input.activation)) return input.current;
  return input.pressed;
}

export function applyStudyChoice<T extends EducationChildState>(child: T, choice: EducationChoice): T {
  if (choice === "local") {
    return {
      ...child,
      educationChoice: "local",
      overseasPreset: null,
      startedFrom: "local",
      startedOverseas: null,
      yearlyCostToday: String(EDUCATION_PRESETS.local.yearlyCostSgd),
      years: String(EDUCATION_PRESETS.local.years),
      presetEdited: false,
    };
  }
  if (choice === "custom") {
    return {
      ...child,
      educationChoice: "custom",
      overseasPreset: null,
      startedFrom: "custom",
      startedOverseas: null,
      presetEdited: false,
    };
  }
  return {
    ...child,
    educationChoice: "overseas",
    overseasPreset: null,
    startedFrom: null,
    startedOverseas: null,
    yearlyCostToday: "",
    years: "",
    presetEdited: false,
  };
}

export function applyOverseasPreset<T extends EducationChildState>(child: T, preset: OverseasPresetId): T {
  const figures = EDUCATION_PRESETS[preset];
  return {
    ...child,
    educationChoice: "overseas",
    overseasPreset: preset,
    startedFrom: "overseas",
    startedOverseas: preset,
    yearlyCostToday: String(figures.yearlyCostSgd),
    years: String(figures.years),
    presetEdited: false,
  };
}

/**
 * Editing the yearly cost or the years shows Custom and drops the estimate.
 * The starting preset and overseas destination stay, so tracking can still name them.
 */
export function editEducationFigure<T extends EducationChildState>(
  child: T,
  field: "years" | "yearlyCostToday",
  value: string,
): T {
  const fromPreset = activePresetId(child) !== null;
  return {
    ...child,
    [field]: value,
    educationChoice: "custom",
    overseasPreset: null,
    presetEdited: fromPreset ? true : child.presetEdited,
  };
}

export function activePresetId(child: EducationChildState): EducationPresetId | null {
  if (child.presetEdited || child.educationChoice === "custom" || child.educationChoice === null) return null;
  if (child.educationChoice === "local") return "local";
  return child.overseasPreset;
}

export function presetEstimateExplanation(preset: EducationPresetId): string {
  if (preset === "australia") return `${EDUCATION_ESTIMATE_CAVEAT} ${AUSTRALIA_TUITION_ASSUMPTION_NOTE}`;
  return EDUCATION_ESTIMATE_CAVEAT;
}

/** Figure name for Estimate Info Opened. No amounts. */
export function presetEstimateFigure(preset: EducationPresetId): string {
  switch (preset) {
    case "local":
      return "Local university";
    case "uk":
      return "UK university";
    case "australia":
      return "Australia university";
    case "us-public":
      return "US public university";
    case "us-private":
      return "US private university";
  }
}

export interface EducationTotalCopy {
  visible: string;
  accessible: string;
}

/**
 * Yearly cost times years, in today's prices. The start year follows the
 * same month count as the cash withdrawal.
 */
export function educationTotalCopy(child: EducationChildState): EducationTotalCopy | null {
  const yearly = parseDecimal(child.yearlyCostToday);
  const years = parseDecimal(child.years);
  if (yearly === null || years === null || yearly < 0 || years < 0) return null;
  const total = yearly * years;
  const visibleAmount = formatMoney(total);
  const spokenAmount = `${new Intl.NumberFormat("en-SG", { maximumFractionDigits: 0 }).format(total)} Singapore dollars`;
  const currentAge = parseDecimal(child.currentAge);
  const startAge = parseDecimal(child.startAge);
  if (currentAge === null || startAge === null) {
    return {
      visible: `About ${visibleAmount} in today’s prices`,
      accessible: `About ${spokenAmount} in today’s prices`,
    };
  }
  const monthsUntilStart = Math.round((startAge - currentAge) * 12);
  const startYear = calendarYearAtMonth(monthsUntilStart);
  return {
    visible: `About ${visibleAmount} in today’s prices, starting in ${startYear}`,
    accessible: `About ${spokenAmount} in today’s prices, starting in ${startYear}`,
  };
}

export interface ChildEducationTracking {
  education_choice: EducationChoice;
  preset_edited: "yes" | "no";
  overseas_destination?: OverseasPresetId;
}

/**
 * Tracking for one child. education_choice is the preset they started from.
 * Custom means they pressed Custom. overseas_destination is sent only for an
 * overseas start. Amounts are not included.
 */
export function childEducationTracking(
  child: Pick<EducationChildState, "startedFrom" | "startedOverseas" | "presetEdited">,
): ChildEducationTracking | null {
  if (child.startedFrom === null) return null;
  const tracked: ChildEducationTracking = {
    education_choice: child.startedFrom,
    preset_edited: child.presetEdited ? "yes" : "no",
  };
  if (child.startedFrom === "overseas" && child.startedOverseas) {
    tracked.overseas_destination = child.startedOverseas;
  }
  return tracked;
}

/**
 * Step Completed properties for every child who has a starting choice.
 * One child uses education_choice, preset_edited, and overseas_destination.
 * Further children use the same names with _2, _3, and so on. No amounts.
 */
export function educationStepAnalytics(
  children: readonly Pick<EducationChildState, "startedFrom" | "startedOverseas" | "presetEdited">[],
): Record<string, string> {
  const tracked = children
    .map((child) => childEducationTracking(child))
    .filter((item): item is ChildEducationTracking => item !== null);
  const props: Record<string, string> = {};
  tracked.forEach((item, index) => {
    const suffix = index === 0 ? "" : `_${index + 1}`;
    props[`education_choice${suffix}`] = item.education_choice;
    props[`preset_edited${suffix}`] = item.preset_edited;
    if (item.overseas_destination) props[`overseas_destination${suffix}`] = item.overseas_destination;
  });
  return props;
}
