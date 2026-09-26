import { CPF_INTEREST } from "../cpf/constants";
import { calculatePlan, type PlanInput, type PlanResult } from "./plan";
import { parseDecimal } from "./parse";

export { parseDecimal };

export interface ChildForm {
  id: string;
  currentAge: string;
  startAge: string;
  years: string;
  yearlyCostToday: string;
  path: "local" | "overseas" | "other";
}

export type OptionalAnswer = "yes" | "no" | null;

export interface PlanFormState {
  currentAge: string;
  retirementAge: string;
  lifeExpectancy: string;
  cashSavings: string;
  monthlyIncome: string;
  annualIncomeGrowth: string;
  monthlyExpensesNow: string;
  monthlyRetirementSpendingToday: string;
  annualReturn: string;
  annualInflation: string;
  extraMonthlySaving: string;
  includeCpf: boolean;
  /** Null until the person answers the CPF question. */
  cpfAnswer: OptionalAnswer;
  oa: string;
  sa: string;
  ra: string;
  ma: string;
  payoutAge: string;
  hasLoan: boolean;
  /** Null until the person answers the housing question. */
  loanAnswer: OptionalAnswer;
  loanBalance: string;
  loanRate: string;
  loanYears: string;
  loanInstalment: string;
  loanPaidFrom: "cash" | "oa";
  /** Null until the person answers the education question. */
  childrenAnswer: OptionalAnswer;
  children: ChildForm[];
}

export const DEFAULT_PLAN_FORM: PlanFormState = {
  currentAge: "35",
  retirementAge: "65",
  lifeExpectancy: "90",
  cashSavings: "40000",
  monthlyIncome: "7000",
  annualIncomeGrowth: "2",
  monthlyExpensesNow: "4000",
  monthlyRetirementSpendingToday: "3500",
  annualReturn: "5",
  annualInflation: "2.5",
  extraMonthlySaving: "0",
  includeCpf: true,
  cpfAnswer: null,
  oa: "40000",
  sa: "25000",
  ra: "0",
  ma: "15000",
  payoutAge: "65",
  hasLoan: false,
  loanAnswer: null,
  loanBalance: "0",
  loanRate: (CPF_INTEREST.hdbConcessionary.value * 100).toFixed(1),
  loanYears: "20",
  loanInstalment: "",
  loanPaidFrom: "oa",
  childrenAnswer: null,
  children: [],
};

export type ValidationReason = "missing" | "format" | "out-of-range";

export interface FieldError {
  field: string;
  message: string;
  reason: ValidationReason;
}

function readNumber(raw: string, field: string, label: string): number | FieldError {
  if (raw.trim() === "") return { field, message: `Enter a number for ${label}.`, reason: "missing" };
  const value = parseDecimal(raw);
  if (value === null) return { field, message: `Enter a number for ${label}.`, reason: "format" };
  return value;
}

function isFieldError(value: number | FieldError): value is FieldError {
  return typeof value !== "number";
}

/** Step checks used by Continue. Invalid ages and blank fields cannot be submitted. */
export function validateStep(step: number, form: PlanFormState): FieldError | null {
  if (step === 0) {
    const current = readNumber(form.currentAge, "currentAge", "current age");
    if (isFieldError(current)) return current;
    const retire = readNumber(form.retirementAge, "retirementAge", "retirement age");
    if (isFieldError(retire)) return retire;
    const life = readNumber(form.lifeExpectancy, "lifeExpectancy", "life expectancy");
    if (isFieldError(life)) return life;
    if (current < 0 || current > 120) {
      return { field: "currentAge", message: "Current age must be between 0 and 120.", reason: "out-of-range" };
    }
    if (retire <= current) {
      return {
        field: "retirementAge",
        message: "Retirement age has to be after your age today.",
        reason: "out-of-range",
      };
    }
    if (life <= retire) {
      return {
        field: "lifeExpectancy",
        message: "Life expectancy has to be after the retirement age.",
        reason: "out-of-range",
      };
    }
  }
  if (step === 1) {
    const fields: [keyof PlanFormState, string][] = [
      ["monthlyIncome", "monthly income"],
      ["annualIncomeGrowth", "income growth"],
      ["monthlyExpensesNow", "monthly expenses"],
      ["monthlyRetirementSpendingToday", "retirement spending"],
      ["cashSavings", "cash savings"],
      ["extraMonthlySaving", "extra monthly saving"],
      ["annualReturn", "annual return"],
      ["annualInflation", "inflation"],
    ];
    for (const [key, label] of fields) {
      const value = readNumber(String(form[key]), key, label);
      if (isFieldError(value)) return value;
    }
  }
  if (step === 2 && form.loanAnswer === "yes") {
    const balance = readNumber(form.loanBalance, "loanBalance", "the loan balance");
    if (isFieldError(balance)) return balance;
    const rate = readNumber(form.loanRate, "loanRate", "the loan interest rate");
    if (isFieldError(rate)) return rate;
    const years = readNumber(form.loanYears, "loanYears", "how many years are left");
    if (isFieldError(years)) return years;
    if (form.loanInstalment.trim() !== "") {
      const instalment = readNumber(form.loanInstalment, "loanInstalment", "the instalment");
      if (isFieldError(instalment)) {
        return { field: "loanInstalment", message: "Enter a number for the instalment, or leave it blank.", reason: instalment.reason };
      }
    }
  }
  if (step === 3 && form.cpfAnswer === "yes") {
    const fields: [keyof PlanFormState, string][] = [
      ["oa", "Ordinary Account"],
      ["sa", "Special Account"],
      ["ra", "Retirement Account"],
      ["ma", "MediSave"],
      ["payoutAge", "CPF LIFE payout age"],
    ];
    for (const [key, label] of fields) {
      const value = readNumber(String(form[key]), key, label);
      if (isFieldError(value)) return value;
    }
  }
  if (step === 4 && form.childrenAnswer === "yes") {
    if (form.children.length === 0) {
      return { field: "addChild", message: "Add a child, or choose No.", reason: "missing" };
    }
    for (const child of form.children) {
      const age = readNumber(child.currentAge, "childAge", "the child’s age");
      if (isFieldError(age)) return age;
      const start = readNumber(child.startAge, "childStartAge", "the age costs start");
      if (isFieldError(start)) return start;
      const years = readNumber(child.years, "childYears", "how many years of costs to plan for");
      if (isFieldError(years)) return years;
      const cost = readNumber(child.yearlyCostToday, "childCost", "the yearly education cost");
      if (isFieldError(cost)) return cost;
    }
  }
  return null;
}

function required(raw: string, field: string, label: string): number | FieldError {
  return readNumber(raw, field, label);
}

export function parsePlanForm(
  form: PlanFormState,
): { ok: true; input: PlanInput; result: PlanResult } | { ok: false; error: FieldError } {
  const currentAge = required(form.currentAge, "currentAge", "current age");
  if (typeof currentAge !== "number") return { ok: false, error: currentAge };
  const retirementAge = required(form.retirementAge, "retirementAge", "retirement age");
  if (typeof retirementAge !== "number") return { ok: false, error: retirementAge };
  const lifeExpectancy = required(form.lifeExpectancy, "lifeExpectancy", "life expectancy");
  if (typeof lifeExpectancy !== "number") return { ok: false, error: lifeExpectancy };
  const cashSavings = required(form.cashSavings, "cashSavings", "cash savings");
  if (typeof cashSavings !== "number") return { ok: false, error: cashSavings };
  const monthlyIncome = required(form.monthlyIncome, "monthlyIncome", "monthly income");
  if (typeof monthlyIncome !== "number") return { ok: false, error: monthlyIncome };
  const annualIncomeGrowth = required(form.annualIncomeGrowth, "annualIncomeGrowth", "income growth");
  if (typeof annualIncomeGrowth !== "number") return { ok: false, error: annualIncomeGrowth };
  const monthlyExpensesNow = required(form.monthlyExpensesNow, "monthlyExpensesNow", "monthly expenses");
  if (typeof monthlyExpensesNow !== "number") return { ok: false, error: monthlyExpensesNow };
  const monthlyRetirementSpendingToday = required(
    form.monthlyRetirementSpendingToday,
    "monthlyRetirementSpendingToday",
    "retirement spending",
  );
  if (typeof monthlyRetirementSpendingToday !== "number") return { ok: false, error: monthlyRetirementSpendingToday };
  const annualReturn = required(form.annualReturn, "annualReturn", "annual return");
  if (typeof annualReturn !== "number") return { ok: false, error: annualReturn };
  const annualInflation = required(form.annualInflation, "annualInflation", "inflation");
  if (typeof annualInflation !== "number") return { ok: false, error: annualInflation };
  const extraMonthlySaving = required(form.extraMonthlySaving, "extraMonthlySaving", "extra monthly saving");
  if (typeof extraMonthlySaving !== "number") return { ok: false, error: extraMonthlySaving };

  const includeCpf = form.cpfAnswer === "yes" ? true : form.cpfAnswer === "no" ? false : form.includeCpf;
  const hasLoan = form.loanAnswer === "yes" ? true : form.loanAnswer === "no" ? false : form.hasLoan;
  const childForms = form.childrenAnswer === "no" ? [] : form.children;

  let cpf: PlanInput["cpf"] = { oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 };
  if (includeCpf) {
    const oa = required(form.oa, "oa", "Ordinary Account");
    if (typeof oa !== "number") return { ok: false, error: oa };
    const sa = required(form.sa, "sa", "Special Account");
    if (typeof sa !== "number") return { ok: false, error: sa };
    const ra = required(form.ra, "ra", "Retirement Account");
    if (typeof ra !== "number") return { ok: false, error: ra };
    const ma = required(form.ma, "ma", "MediSave");
    if (typeof ma !== "number") return { ok: false, error: ma };
    const payoutAge = required(form.payoutAge, "payoutAge", "CPF LIFE payout age");
    if (typeof payoutAge !== "number") return { ok: false, error: payoutAge };
    cpf = { oa, sa, ra, ma, payoutAge };
  }

  let loan: PlanInput["loan"] = null;
  if (hasLoan) {
    const balance = required(form.loanBalance, "loanBalance", "loan balance");
    if (typeof balance !== "number") return { ok: false, error: balance };
    const rate = required(form.loanRate, "loanRate", "loan interest");
    if (typeof rate !== "number") return { ok: false, error: rate };
    const years = required(form.loanYears, "loanYears", "loan tenure");
    if (typeof years !== "number") return { ok: false, error: years };
    const instalmentRaw = form.loanInstalment.trim();
    let monthlyInstalment: number | undefined;
    if (instalmentRaw !== "") {
      const parsed = parseDecimal(instalmentRaw);
      if (parsed === null) {
        return {
          ok: false,
          error: { field: "loanInstalment", message: "Enter a number for the instalment.", reason: "format" },
        };
      }
      monthlyInstalment = parsed;
    }
    loan = {
      balance,
      annualInterestRate: rate / 100,
      remainingMonths: Math.round(years * 12),
      monthlyInstalment,
      paidFrom: form.loanPaidFrom,
    };
  }

  const children: PlanInput["children"] = [];
  for (const child of childForms) {
    const childAge = required(child.currentAge, "childAge", "the child’s age");
    if (typeof childAge !== "number") return { ok: false, error: childAge };
    const startAge = required(child.startAge, "childStartAge", "the age costs start");
    if (typeof startAge !== "number") return { ok: false, error: startAge };
    const years = required(child.years, "childYears", "years of study");
    if (typeof years !== "number") return { ok: false, error: years };
    const cost = required(child.yearlyCostToday, "childCost", "the yearly education cost");
    if (typeof cost !== "number") return { ok: false, error: cost };
    children.push({ currentAge: childAge, startAge, years, yearlyCostToday: cost });
  }

  const input: PlanInput = {
    currentAge,
    retirementAge,
    lifeExpectancy,
    cashSavings,
    monthlyIncome,
    annualIncomeGrowth: annualIncomeGrowth / 100,
    monthlyExpensesNow,
    monthlyRetirementSpendingToday,
    annualReturn: annualReturn / 100,
    annualInflation: annualInflation / 100,
    extraMonthlySaving,
    includeCpf,
    cpf,
    loan,
    children,
  };

  const result = calculatePlan(input);
  if (!result.valid) {
    return { ok: false, error: { field: "form", message: result.errors[0] ?? "Check the inputs.", reason: "out-of-range" } };
  }
  return { ok: true, input, result };
}
