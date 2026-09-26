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

export type EducationFigureField = "years" | "yearlyCostToday";

/** Typing updates the figure only. The preset, country row, and estimate stay until blur. */
export function draftEducationFigure<T extends EducationChildState>(
  child: T,
  field: EducationFigureField,
  value: string,
): T {
  return { ...child, [field]: value };
}

function presetFigure(preset: EducationPresetId, field: EducationFigureField): number {
  const figures = EDUCATION_PRESETS[preset];
  return field === "years" ? figures.years : figures.yearlyCostSgd;
}

function matchesPresetFigure(value: string, preset: EducationPresetId, field: EducationFigureField): boolean {
  const parsed = parseDecimal(value);
  return parsed !== null && parsed === presetFigure(preset, field);
}

/**
 * Leaving the field compares it with the preset. A different figure shows Custom
 * and drops the estimate. The starting preset and destination stay for tracking.
 * The same figure, including one typed and then changed back, changes nothing.
 */
export function blurEducationFigure<T extends EducationChildState>(
  child: T,
  field: EducationFigureField,
  value: string,
): T {
  const drafted = draftEducationFigure(child, field, value);
  const presetId = activePresetId(child);
  if (!presetId || matchesPresetFigure(value, presetId, field)) return drafted;
  return {
    ...drafted,
    educationChoice: "custom",
    overseasPreset: null,
    presetEdited: true,
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
  children_count: number;
  education_choice: EducationChoice[];
  overseas_destination: ("none" | OverseasPresetId)[];
  preset_edited: ("yes" | "no")[];
}

/**
 * One list per property, in child order, lined up by index.
 * overseas_destination is "none" when that child did not start overseas.
 * education_choice is the preset they started from, not the Custom pill after an edit.
 * No amounts.
 */
export function educationStepAnalytics(
  children: readonly Pick<EducationChildState, "startedFrom" | "startedOverseas" | "presetEdited">[],
): EducationStepAnalytics {
  return {
    children_count: children.length,
    education_choice: children.map((child) => child.startedFrom ?? "custom"),
    overseas_destination: children.map((child) =>
      child.startedFrom === "overseas" && child.startedOverseas ? child.startedOverseas : "none",
    ),
    preset_edited: children.map((child) => (child.presetEdited ? "yes" : "no")),
  };
}
