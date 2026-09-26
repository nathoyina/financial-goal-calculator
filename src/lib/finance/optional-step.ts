import { STEP_NAMES, stepCompletedProps } from "../analytics/track";
import { educationStepAnalytics } from "./education-choice";
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

/** Pressed state for the two buttons. Unanswered means neither is pressed. */
export function optionalButtonState(answer: OptionalAnswer, controlsId: string) {
  return {
    groupRole: "group" as const,
    yes: {
      expanded: answer === "yes",
      controls: controlsId,
      pressed: answer === "yes",
    },
    no: {
      pressed: answer === "no",
    },
    showsContinue: answer === "yes",
  };
}

const CHOICE_KEYS = new Set(["click", "Enter", " ", "Spacebar"]);
const ARROW_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

export interface ChoicePress {
  step: number;
  form: PlanFormState;
  button: "yes" | "no";
  activation: string;
  locked: boolean;
}

export interface ChoicePressResult {
  form: PlanFormState;
  nextStep: number | null;
  completed: Record<string, string> | null;
  locked: boolean;
}

/**
 * Buttons, not a radiogroup. Arrows do nothing. No moves on for click, Enter, or Space.
 * A locked No press is the second half of a double press and does not complete again.
 */
export function pressOptionalButton(input: ChoicePress): ChoicePressResult {
  const stay: ChoicePressResult = {
    form: input.form,
    nextStep: null,
    completed: null,
    locked: input.locked,
  };
  if (ARROW_KEYS.has(input.activation) || !CHOICE_KEYS.has(input.activation)) return stay;
  if (input.button === "no" && input.locked) return stay;

  const choice = chooseOptionalAnswer(input.step, input.form, input.button);
  return {
    form: choice.form,
    nextStep: choice.nextStep,
    completed: choice.completed,
    locked: input.button === "no" ? true : input.locked,
  };
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
    const completed =
      stepName === "education"
        ? stepCompletedProps(stepName, "no", educationStepAnalytics(form.children))
        : stepCompletedProps(stepName, "no");
    return { form: next, nextStep: step + 1, completed };
  }
  return { form: next, nextStep: null, completed: null };
}
