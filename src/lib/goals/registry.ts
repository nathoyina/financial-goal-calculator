import type { RetirementInput, RetirementResult } from "../finance/retirement";
import { calculateRetirement } from "../finance/retirement";
import type { SavingsGoal } from "./types";

export const retirementGoal: SavingsGoal<RetirementInput, RetirementResult> = {
  kind: "retirement",
  name: "Retirement",
  description: "Save through the working years, then draw the balance down until a chosen age.",
  calculate: calculateRetirement,
};

/** Goals the app knows how to plan. v1 registers retirement only. */
export const goals = [retirementGoal] as const;
