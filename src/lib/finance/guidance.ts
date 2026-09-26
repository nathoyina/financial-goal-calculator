import { CPF_WAGE, calendarYearAtMonth } from "../cpf/constants";
import { monthlyContributions } from "../cpf/project";
import { formatMoney } from "./format";

function formatYearSpan(years: number): string {
  const rounded = Math.round(years * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  const unit = rounded === 1 ? "year" : "years";
  return `${text} ${unit}`;
}

/** Live line under retirement age. Null when either age is not a real number. */
export function yearsUntilRetirementLine(currentAge: number, retirementAge: number): string | null {
  if (!Number.isFinite(currentAge) || !Number.isFinite(retirementAge)) return null;
  const diff = retirementAge - currentAge;
  if (Math.abs(diff) < 0.05) return "That's the same as your age today.";
  if (diff > 0) return `That's ${formatYearSpan(diff)} from now.`;
  return `That's ${formatYearSpan(-diff)} before your age today.`;
}

export interface TakeHomeInput {
  includeCpf: boolean;
  currentAge: number;
  monthlyIncome: number;
}

/**
 * Today's take-home pay. With CPF on, this is gross income minus the employee
 * contribution from monthlyContributions (age band, wage ceiling, below-S$750 rule).
 * With CPF off, the simulation deducts nothing, so take-home is the gross income.
 */
export function takeHomePay(input: TakeHomeInput): number {
  if (!input.includeCpf) return input.monthlyIncome;
  const { employee } = monthlyContributions(input.currentAge, input.monthlyIncome, calendarYearAtMonth(0));
  return input.monthlyIncome - employee;
}

export function spendingExceedsTakeHome(
  input: TakeHomeInput & { monthlyExpensesNow: number },
): boolean {
  return Math.round(input.monthlyExpensesNow - takeHomePay(input)) >= 1;
}

/** The spending-step and verdict sentence. Null when spending is within take-home pay. */
export function takeHomeExcessSentence(
  input: TakeHomeInput & { monthlyExpensesNow: number },
): string | null {
  if (!spendingExceedsTakeHome(input)) return null;
  const takeHome = takeHomePay(input);
  const excess = input.monthlyExpensesNow - takeHome;
  return `That's about ${formatMoney(excess)} more than your take-home pay of ${formatMoney(takeHome)}.`;
}

/** Calendar year whose dollars the flat CPF LIFE payout is expressed in. */
export function cpfLifeDollarYear(currentAge: number, payoutAge: number): number {
  const months = Math.max(0, Math.round((payoutAge - currentAge) * 12));
  return calendarYearAtMonth(months);
}

/** Deflates a flat future payout back to today's prices with the user's inflation rate. */
export function cpfLifeInTodaysMoney(input: {
  currentAge: number;
  payoutAge: number;
  annualInflation: number;
  monthlyPayout: number;
}): number {
  const months = Math.max(0, Math.round((input.payoutAge - input.currentAge) * 12));
  const years = months / 12;
  if (years === 0 || input.annualInflation === 0) return input.monthlyPayout;
  return input.monthlyPayout / (1 + input.annualInflation) ** years;
}

/**
 * True when CPF is included and some working-year salary is above the ordinary
 * wage ceiling. The plan holds that ceiling flat; the verdict should say so.
 */
export function projectedSalaryExceedsCeiling(input: {
  includeCpf: boolean;
  currentAge: number;
  retirementAge: number;
  monthlyIncome: number;
  annualIncomeGrowth: number;
}): boolean {
  if (!input.includeCpf) return false;
  const ceiling = CPF_WAGE.ordinaryCeiling.value;
  const retirementMonth = Math.round(input.retirementAge * 12) - Math.round(input.currentAge * 12);
  for (let month = 0; month < retirementMonth; month += 1) {
    const wage = input.monthlyIncome * (1 + input.annualIncomeGrowth) ** Math.floor(month / 12);
    if (wage > ceiling) return true;
  }
  return false;
}
