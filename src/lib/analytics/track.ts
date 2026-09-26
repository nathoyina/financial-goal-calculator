export interface TrackedEvent {
  event: string;
  props: Record<string, string | number | boolean>;
}

/**
 * Analytics sink. There is no SDK yet (Amplitude can subscribe later).
 * Events stay in memory so tests can read them. Nothing is sent.
 */
const events: TrackedEvent[] = [];

export function track(event: string, props: Record<string, string | number | boolean> = {}): void {
  events.push({ event, props });
}

export function getTrackedEvents(): readonly TrackedEvent[] {
  return events;
}

export function clearTrackedEvents(): void {
  events.length = 0;
}

export const STEP_NAMES = [
  "retirement age",
  "income & expenses",
  "housing loan",
  "CPF",
  "education",
] as const;

export type StepName = (typeof STEP_NAMES)[number];

export function retirementAgeBand(age: number): string {
  if (age < 50) return "under-50";
  if (age < 55) return "50-54";
  if (age < 60) return "55-59";
  if (age < 65) return "60-64";
  if (age < 70) return "65-69";
  return "70-plus";
}

/** Bands only. Never pass a salary, balance, or loan amount. */
export function gapBand(gap: number): string {
  const size = Math.abs(gap);
  if (size < 1_000) return "none";
  if (size < 100_000) return "under-100k";
  if (size < 500_000) return "100k-to-500k";
  return "over-500k";
}

const OPTIONAL_STEPS = new Set<StepName>(["housing loan", "CPF", "education"]);

/**
 * Step Completed props. Housing, CPF, and education also record the Yes or No answer.
 * Education adds each child's starting preset. overseas_destination is included
 * only when that child started from overseas. No amounts.
 */
export function stepCompletedProps(
  step: StepName,
  answer?: "yes" | "no",
  education?: Record<string, string>,
): Record<string, string> {
  const props: Record<string, string> = { step };
  if (OPTIONAL_STEPS.has(step) && answer) props.answer = answer;
  if (step === "education" && education) {
    for (const [key, value] of Object.entries(education)) props[key] = value;
  }
  return props;
}

export function verdictAnalyticsProps(input: {
  outcome: "on-track" | "shortfall";
  gap: number;
  retirementAge: number;
  hasHousingLoan: boolean;
  /** True when the calculation includes CPF balances. A Yes later switched to No is false. */
  hasCpf: boolean;
  hasChildren: boolean;
  reliesOnEstimate: boolean;
  /** True only for the first verdict of this browser session. */
  isFirstVerdict: boolean;
  /** Today's spending is above take-home pay. No amounts are recorded. */
  spendingExceedsTakeHome: boolean;
}): Record<string, string | number | boolean> {
  return {
    outcome: input.outcome,
    gap_band: gapBand(input.gap),
    retirement_age_band: retirementAgeBand(input.retirementAge),
    has_housing_loan: input.hasHousingLoan,
    has_cpf: input.hasCpf,
    has_children: input.hasChildren,
    relies_on_estimate: input.reliesOnEstimate,
    is_first_verdict: input.isFirstVerdict,
    spending_exceeds_take_home: input.spendingExceedsTakeHome,
  };
}

/** One Inputs Adjusted After Verdict event per verdict the user has seen. */
export function shouldTrackAdjustmentAfterVerdict(input: {
  verdictSeen: boolean;
  alreadyTrackedForThisVerdict: boolean;
  source: "user" | "suggestion";
}): boolean {
  return input.verdictSeen && input.source === "user" && !input.alreadyTrackedForThisVerdict;
}
