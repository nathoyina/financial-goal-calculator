import { CPF_INTEREST } from "../cpf/constants";
import { calculatePlan, type PlanInput, type PlanResult } from "./plan";

export interface ChildForm {
  id: string;
  currentAge: string;
  startAge: string;
  years: string;
  yearlyCostToday: string;
  path: "local" | "overseas" | "other";
}

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
  oa: string;
  sa: string;
  ra: string;
  ma: string;
  payoutAge: string;
  hasLoan: boolean;
  loanBalance: string;
  loanRate: string;
  loanYears: string;
  loanInstalment: string;
  loanPaidFrom: "cash" | "oa";
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
  oa: "40000",
  sa: "25000",
  ra: "0",
  ma: "15000",
  payoutAge: "65",
  hasLoan: false,
  loanBalance: "0",
  loanRate: (CPF_INTEREST.hdbConcessionary.value * 100).toFixed(1),
  loanYears: "20",
  loanInstalment: "",
  loanPaidFrom: "oa",
  children: [],
};

export function parseDecimal(raw: string): number | null {
  let cleaned = raw.trim().replace(/,/g, "").replace(/%$/, "").trim();
  if (cleaned.startsWith(".")) cleaned = `0${cleaned}`;
  if (cleaned.startsWith("-.")) cleaned = `-0${cleaned.slice(1)}`;
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export interface FieldError {
  field: string;
  message: string;
}

function required(raw: string, field: string, label: string): number | FieldError {
  const value = parseDecimal(raw);
  if (value === null) return { field, message: `Enter a number for ${label}.` };
  return value;
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

  let cpf: PlanInput["cpf"] = { oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 };
  if (form.includeCpf) {
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
  if (form.hasLoan) {
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
      if (parsed === null) return { ok: false, error: { field: "loanInstalment", message: "Enter a number for the instalment." } };
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
  for (const child of form.children) {
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
    includeCpf: form.includeCpf,
    cpf,
    loan,
    children,
  };

  const result = calculatePlan(input);
  if (!result.valid) return { ok: false, error: { field: "form", message: result.errors[0] ?? "Check the inputs." } };
  return { ok: true, input, result };
}
