import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_FORM, parsePlanForm } from "./plan-form";
import { chooseOptionalAnswer, optionalAnswer, showsContinue } from "./optional-step";

const child = {
  id: "child-1",
  currentAge: "6",
  startAge: "19",
  years: "3",
  yearlyCostToday: "12000",
  path: "local" as const,
};

describe("optional yes or no choice", () => {
  it("hides Continue until Yes, and leaves both pills unselected at first", () => {
    expect(showsContinue(0, DEFAULT_PLAN_FORM)).toBe(true);
    expect(showsContinue(1, DEFAULT_PLAN_FORM)).toBe(true);
    expect(optionalAnswer(2, DEFAULT_PLAN_FORM)).toBeNull();
    expect(optionalAnswer(3, DEFAULT_PLAN_FORM)).toBeNull();
    expect(optionalAnswer(4, DEFAULT_PLAN_FORM)).toBeNull();
    expect(showsContinue(2, DEFAULT_PLAN_FORM)).toBe(false);
    expect(showsContinue(3, DEFAULT_PLAN_FORM)).toBe(false);
    expect(showsContinue(4, DEFAULT_PLAN_FORM)).toBe(false);

    const yes = chooseOptionalAnswer(2, DEFAULT_PLAN_FORM, "yes");
    expect(yes.nextStep).toBeNull();
    expect(yes.completed).toBeNull();
    expect(showsContinue(2, yes.form)).toBe(true);
    expect(optionalAnswer(2, yes.form)).toBe("yes");
  });

  it("advances on No and records Step Completed with answer no", () => {
    const housing = chooseOptionalAnswer(2, { ...DEFAULT_PLAN_FORM, loanBalance: "180000" }, "no");
    expect(housing.nextStep).toBe(3);
    expect(housing.completed).toEqual({ step: "housing loan", answer: "no" });
    expect(housing.form.loanBalance).toBe("180000");
    expect(showsContinue(2, housing.form)).toBe(false);

    const cpf = chooseOptionalAnswer(3, DEFAULT_PLAN_FORM, "no");
    expect(cpf.nextStep).toBe(4);
    expect(cpf.completed).toEqual({ step: "CPF", answer: "no" });

    const education = chooseOptionalAnswer(4, { ...DEFAULT_PLAN_FORM, children: [child] }, "no");
    expect(education.nextStep).toBe(5);
    expect(education.completed).toEqual({ step: "education", answer: "no" });
    expect(education.form.children).toEqual([child]);
  });

  it("shows No still selected when returning, and Yes then No then Yes restores the figures", () => {
    const typed = {
      ...DEFAULT_PLAN_FORM,
      loanBalance: "180000",
      loanRate: "2.6",
      loanYears: "15",
      loanPaidFrom: "cash" as const,
      oa: "88000",
      children: [child],
    };

    const loanNo = chooseOptionalAnswer(2, typed, "no");
    expect(optionalAnswer(2, loanNo.form)).toBe("no");
    expect(showsContinue(2, loanNo.form)).toBe(false);

    const loanYes = chooseOptionalAnswer(2, loanNo.form, "yes");
    const loanAgainNo = chooseOptionalAnswer(2, loanYes.form, "no");
    const loanRestored = chooseOptionalAnswer(2, loanAgainNo.form, "yes");
    expect(loanRestored.form.loanBalance).toBe("180000");
    expect(loanRestored.form.loanYears).toBe("15");
    expect(showsContinue(2, loanRestored.form)).toBe(true);

    const cpfYes = chooseOptionalAnswer(3, typed, "yes");
    const cpfNo = chooseOptionalAnswer(3, cpfYes.form, "no");
    const cpfRestored = chooseOptionalAnswer(3, cpfNo.form, "yes");
    expect(cpfRestored.form.oa).toBe("88000");

    const childYes = chooseOptionalAnswer(4, typed, "yes");
    const childNo = chooseOptionalAnswer(4, childYes.form, "no");
    const childRestored = chooseOptionalAnswer(4, childNo.form, "yes");
    expect(childRestored.form.children).toEqual([child]);

    const ignored = parsePlanForm(loanAgainNo.form);
    const counted = parsePlanForm(loanRestored.form);
    expect(ignored.ok && ignored.input.loan).toBeNull();
    expect(counted.ok && counted.input.loan?.balance).toBe(180_000);
  });
});
