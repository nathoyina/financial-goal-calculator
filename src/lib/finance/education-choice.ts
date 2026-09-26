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
  /** Null until a country is pressed. Only set while Overseas is the choice. */
  overseasPreset: OverseasPresetId | null;
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
      presetEdited: false,
    };
  }
  return {
    ...child,
    educationChoice: "overseas",
    overseasPreset: null,
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
    yearlyCostToday: String(figures.yearlyCostSgd),
    years: String(figures.years),
    presetEdited: false,
  };
}

/** Editing the yearly cost or the years leaves the preset and drops the estimate. */
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

export interface EducationStepAnalytics {
  education_choice: EducationChoice;
  preset_edited: "yes" | "no";
}

/**
 * One choice for the step. Children who all picked the same pill report that
 * pill. A mix, or no child, is custom. preset_edited is yes when any child
 * changed a preset figure. Amounts are not included.
 */
export function educationStepAnalytics(
  children: readonly Pick<EducationChildState, "educationChoice" | "presetEdited">[],
): EducationStepAnalytics {
  const preset_edited = children.some((child) => child.presetEdited) ? "yes" : "no";
  const choices = children.map((child) => child.educationChoice ?? "custom");
  const first = choices[0];
  const unanimous = choices.length > 0 && choices.every((choice) => choice === first);
  return {
    education_choice: unanimous && first ? first : "custom",
    preset_edited,
  };
}
