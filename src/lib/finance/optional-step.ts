import { STEP_NAMES, stepCompletedProps } from "../analytics/track";
import type { OptionalAnswer, PlanFormState } from "./plan-form";

export function optionalAnswer(step: number, form: PlanFormState): OptionalAnswer {
  if (step === 2) return form.loanAnswer;
  if (step === 3) return form.cpfAnswer;
  if (step === 4) return form.childrenAnswer;
  return null;
}

/** Age and income always offer Continue. A yes/no step offers it only after Yes. */
export function showsContinue(step: number, form: PlanFormState): boolean {
  if (step < 0 || step > 4) return false;
  if (step < 2) return true;
  return optionalAnswer(step, form) === "yes";
}

export interface OptionalChoice {
  form: PlanFormState;
  /** Set when No completes the step and moves on. Null when Yes only opens the fields. */
  nextStep: number | null;
  completed: Record<string, string> | null;
}

/**
 * Yes stores the answer and keeps every typed figure.
 * No stores the answer, keeps those figures for a later Yes, and completes the step.
 */
export function chooseOptionalAnswer(step: number, form: PlanFormState, answer: "yes" | "no"): OptionalChoice {
  const stepName = STEP_NAMES[step];
  if (!stepName || step < 2 || step > 4) return { form, nextStep: null, completed: null };

  const next: PlanFormState = { ...form };
  if (step === 2) {
    next.loanAnswer = answer;
    next.hasLoan = answer === "yes";
  } else if (step === 3) {
    next.cpfAnswer = answer;
    next.includeCpf = answer === "yes";
  } else {
    next.childrenAnswer = answer;
  }

  if (answer === "no") {
    return { form: next, nextStep: step + 1, completed: stepCompletedProps(stepName, "no") };
  }
  return { form: next, nextStep: null, completed: null };
}
