import {
  calculateRetirement,
  type RetirementInput,
  type RetirementResult,
} from "./retirement";

export interface RetirementFormState {
  currentAge: string;
  retirementAge: string;
  lifeExpectancy: string;
  currentSavings: string;
  monthlyContribution: string;
  annualReturnPercent: string;
  annualInflationPercent: string;
  monthlySpendingToday: string;
  monthlyRetirementIncomeToday: string;
}

export const DEFAULT_FORM: RetirementFormState = {
  currentAge: "35",
  retirementAge: "65",
  lifeExpectancy: "90",
  currentSavings: "150000",
  monthlyContribution: "1800",
  annualReturnPercent: "5",
  annualInflationPercent: "2.5",
  monthlySpendingToday: "4000",
  monthlyRetirementIncomeToday: "0",
};

export type FieldErrors = Partial<Record<keyof RetirementFormState, string>>;

export type ParsedRetirementForm =
  | { ok: true; input: RetirementInput; result: RetirementResult }
  | { ok: false; fieldErrors: FieldErrors; formError: string | null };

const FIELD_LABELS: Record<keyof RetirementFormState, string> = {
  currentAge: "Current age",
  retirementAge: "Retirement age",
  lifeExpectancy: "Life expectancy",
  currentSavings: "Current savings",
  monthlyContribution: "Monthly contribution",
  annualReturnPercent: "Expected annual return",
  annualInflationPercent: "Expected inflation",
  monthlySpendingToday: "Monthly spending in retirement",
  monthlyRetirementIncomeToday: "CPF LIFE monthly payout",
};

export function parseDecimal(raw: string): number | null {
  let cleaned = raw.trim().replace(/,/g, "").replace(/%$/, "").trim();
  if (cleaned.startsWith(".")) cleaned = `0${cleaned}`;
  if (cleaned.startsWith("-.")) cleaned = `-0${cleaned.slice(1)}`;
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function parseRetirementForm(
  form: RetirementFormState,
  options: { includeRetirementIncome: boolean },
): ParsedRetirementForm {
  const fieldErrors: FieldErrors = {};
  const read = (key: keyof RetirementFormState): number | null => {
    const value = parseDecimal(form[key]);
    if (value === null) {
      fieldErrors[key] = `Enter a number for ${FIELD_LABELS[key].toLowerCase()}.`;
    }
    return value;
  };

  const currentAge = read("currentAge");
  const retirementAge = read("retirementAge");
  const lifeExpectancy = read("lifeExpectancy");
  const currentSavings = read("currentSavings");
  const monthlyContribution = read("monthlyContribution");
  const annualReturnPercent = read("annualReturnPercent");
  const annualInflationPercent = read("annualInflationPercent");
  const monthlySpendingToday = read("monthlySpendingToday");
  const monthlyRetirementIncomeToday = options.includeRetirementIncome
    ? read("monthlyRetirementIncomeToday")
    : 0;

  if (
    currentAge === null ||
    retirementAge === null ||
    lifeExpectancy === null ||
    currentSavings === null ||
    monthlyContribution === null ||
    annualReturnPercent === null ||
    annualInflationPercent === null ||
    monthlySpendingToday === null ||
    monthlyRetirementIncomeToday === null
  ) {
    return { ok: false, fieldErrors, formError: null };
  }

  const input: RetirementInput = {
    currentAge,
    retirementAge,
    lifeExpectancy,
    currentSavings,
    monthlyContribution,
    annualReturn: annualReturnPercent / 100,
    annualInflation: annualInflationPercent / 100,
    monthlySpendingToday,
    monthlyRetirementIncomeToday,
  };

  const result = calculateRetirement(input);
  if (!result.valid) {
    return { ok: false, fieldErrors: {}, formError: result.errors[0] ?? "Check the inputs." };
  }

  return { ok: true, input, result };
}
