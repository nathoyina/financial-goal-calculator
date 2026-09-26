import { describe, expect, it } from "vitest";
import { DEFAULT_FORM, parseRetirementForm } from "../finance/form";
import { calculateRetirement } from "../finance/retirement";
import { goals, retirementGoal } from "./registry";

describe("goal registry", () => {
  it("ships retirement only, through the shared calculator", () => {
    expect(goals.map((goal) => goal.kind)).toEqual(["retirement"]);
    const parsed = parseRetirementForm(DEFAULT_FORM, { includeRetirementIncome: false });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(retirementGoal.calculate(parsed.input)).toEqual(calculateRetirement(parsed.input));
  });
});
