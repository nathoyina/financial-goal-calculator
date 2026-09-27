import { describe, expect, it } from "vitest";
import { DEFAULT_PLAN_FORM, parsePlanForm } from "./plan-form";
import { chooseOptionalAnswer, optionalAnswer, optionalButtonState, pressOptionalButton, showsContinue } from "./optional-step";

const child = {
  id: "child-1",
  currentAge: "6",
  startAge: "19",
  years: "3",
  yearlyCostToday: "12000",
  educationChoice: "custom" as const,
  overseasPreset: null,
  startedFrom: "custom" as const,
  startedOverseas: null,
  presetEdited: false,
};

describe("optional yes or no choice", () => {
  it("hides Continue until Yes, and leaves both pills unselected at first", () => {
    expect(showsContinue(0, DEFAULT_PLAN_FORM)).toBe(true);
    expect(showsContinue(1, DEFAULT_PLAN_FORM)).toBe(true);
    expect(optionalAnswer(2, DEFAULT_PLAN_FORM)).toBeNull();
    expect(optionalAnswer(3, DEFAULT_PLAN_FORM)).toBeNull();
    expect(optionalAnswer(4, DEFAULT_PLAN_FORM)).toBeNull();
    expect(showsContinue(2, DEFAULT_PLAN_FORM)).toBe(false);
    expect(showsContinue(3, DEFAULT_PLAN_FORM)).toBe(true);
    expect(showsContinue(4, DEFAULT_PLAN_FORM)).toBe(false);

    const unanswered = optionalButtonState(null, "loan-fields");
    expect(unanswered.groupRole).toBe("group");
    expect(unanswered.yes.expanded).toBe(false);
    expect(unanswered.yes.pressed).toBe(false);
    expect(unanswered.no.pressed).toBe(false);
    expect(unanswered.yes.controls).toBe("loan-fields");

    const yes = chooseOptionalAnswer(2, DEFAULT_PLAN_FORM, "yes");
    expect(yes.nextStep).toBeNull();
    expect(yes.completed).toBeNull();
    expect(showsContinue(2, yes.form)).toBe(true);
    expect(optionalAnswer(2, yes.form)).toBe("yes");
    const opened = optionalButtonState(optionalAnswer(2, yes.form), "loan-fields");
    expect(opened.yes.expanded).toBe(true);
    expect(opened.yes.pressed).toBe(true);
    expect(opened.no.pressed).toBe(false);
    expect(opened.showsContinue).toBe(true);
  });

  it("advances on No and records Step Completed with answer no", () => {
    const housing = chooseOptionalAnswer(2, { ...DEFAULT_PLAN_FORM, loanBalance: "180000" }, "no");
    expect(housing.nextStep).toBe(3);
    expect(housing.completed).toEqual({ step: "housing loan", answer: "no" });
    expect(housing.form.loanBalance).toBe("180000");
    expect(showsContinue(2, housing.form)).toBe(false);

    const cpf = chooseOptionalAnswer(3, DEFAULT_PLAN_FORM, "no");
    expect(cpf.nextStep).toBeNull();
    expect(cpf.completed).toBeNull();
    expect(cpf.form).toBe(DEFAULT_PLAN_FORM);

    const education = chooseOptionalAnswer(4, { ...DEFAULT_PLAN_FORM, children: [child] }, "no");
    expect(education.nextStep).toBe(5);
    expect(education.completed).toEqual({
      step: "education",
      answer: "no",
    });
    expect(education.form.children).toEqual([child]);
  });

  it("shows No still selected when returning, and Yes then No then Yes restores the figures", () => {
    const typed = {
      ...DEFAULT_PLAN_FORM,
      loanBalance: "180000",
      loanRate: "2.6",
      loanYears: "15",
      loanPaidFrom: "cash" as const,
      children: [child],
    };

    const loanNo = chooseOptionalAnswer(2, typed, "no");
    expect(optionalAnswer(2, loanNo.form)).toBe("no");
    expect(showsContinue(2, loanNo.form)).toBe(false);
    const returned = optionalButtonState(optionalAnswer(2, loanNo.form), "loan-fields");
    expect(returned.no.pressed).toBe(true);
    expect(returned.yes.pressed).toBe(false);
    expect(returned.yes.expanded).toBe(false);

    const loanYes = chooseOptionalAnswer(2, loanNo.form, "yes");
    const loanAgainNo = chooseOptionalAnswer(2, loanYes.form, "no");
    const loanRestored = chooseOptionalAnswer(2, loanAgainNo.form, "yes");
    expect(loanRestored.form.loanBalance).toBe("180000");
    expect(loanRestored.form.loanYears).toBe("15");
    expect(showsContinue(2, loanRestored.form)).toBe(true);

    const childYes = chooseOptionalAnswer(4, typed, "yes");
    const childNo = chooseOptionalAnswer(4, childYes.form, "no");
    const childRestored = chooseOptionalAnswer(4, childNo.form, "yes");
    expect(childRestored.form.children).toEqual([child]);

    const ignored = parsePlanForm(loanAgainNo.form);
    const counted = parsePlanForm(loanRestored.form);
    expect(ignored.ok && ignored.input.loan).toBeNull();
    expect(counted.ok && counted.input.loan?.balance).toBe(180_000);
  });

  it("ignores arrow keys and advances No only on click, Enter, or Space", () => {
    const arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    for (const button of ["yes", "no"] as const) {
      for (const activation of arrows) {
        const pressed = pressOptionalButton({
          step: 2,
          form: DEFAULT_PLAN_FORM,
          button,
          activation,
          locked: false,
        });
        expect(pressed.form).toBe(DEFAULT_PLAN_FORM);
        expect(pressed.nextStep).toBeNull();
        expect(pressed.completed).toBeNull();
        expect(optionalAnswer(2, pressed.form)).toBeNull();
      }
    }

    for (const activation of ["click", "Enter", " "]) {
      const no = pressOptionalButton({
        step: 2,
        form: DEFAULT_PLAN_FORM,
        button: "no",
        activation,
        locked: false,
      });
      expect(no.nextStep).toBe(3);
      expect(no.completed).toEqual({ step: "housing loan", answer: "no" });
      expect(no.locked).toBe(true);

      const yes = pressOptionalButton({
        step: 2,
        form: DEFAULT_PLAN_FORM,
        button: "yes",
        activation,
        locked: false,
      });
      expect(yes.nextStep).toBeNull();
      expect(yes.completed).toBeNull();
      expect(optionalButtonState(optionalAnswer(2, yes.form), "loan-fields").yes.expanded).toBe(true);
      expect(showsContinue(2, yes.form)).toBe(true);
    }

    const tab = pressOptionalButton({
      step: 2,
      form: DEFAULT_PLAN_FORM,
      button: "no",
      activation: "Tab",
      locked: false,
    });
    expect(tab.nextStep).toBeNull();
    expect(tab.completed).toBeNull();
  });

  it("records one Step Completed when No is pressed twice before the step changes", () => {
    const first = pressOptionalButton({
      step: 4,
      form: DEFAULT_PLAN_FORM,
      button: "no",
      activation: "Enter",
      locked: false,
    });
    const second = pressOptionalButton({
      step: 4,
      form: first.form,
      button: "no",
      activation: "click",
      locked: first.locked,
    });
    expect(first.completed).toEqual({
      step: "education",
      answer: "no",
    });
    expect(second.completed).toBeNull();
    expect(second.nextStep).toBeNull();
    expect([first.completed, second.completed].filter(Boolean)).toHaveLength(1);
  });
});
