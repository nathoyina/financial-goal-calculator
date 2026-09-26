import { CPF_WAGE, calendarYearAtMonth } from "../cpf/constants";
import { monthlyContributions } from "../cpf/project";
import { formatMoney } from "./format";
import { realAnnualReturn } from "./rates";

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
  currentAge: number;
  monthlyIncome: number;
}

/**
 * Today's take-home pay: gross income minus the employee contribution from
 * monthlyContributions (age band, wage ceiling, below-S$750 rule). Leaving CPF
 * balances out of the plan does not turn this deduction off.
 */
export function takeHomePay(input: TakeHomeInput): number {
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

/** Future dollars divided by inflation since today. A zero rate or a zero span returns the same amount. */
export function inTodaysMoney(futureValue: number, yearsFromToday: number, annualInflation: number): number {
  if (!Number.isFinite(futureValue) || !Number.isFinite(yearsFromToday) || !Number.isFinite(annualInflation)) {
    return futureValue;
  }
  if (yearsFromToday === 0 || annualInflation === 0) return futureValue;
  return futureValue / (1 + annualInflation) ** yearsFromToday;
}

export type DollarMode = "today" | "future";

/** Chart and table amount. Today's money is the future balance deflated back to today. */
export function displayedBalance(input: {
  balance: number;
  age: number;
  currentAge: number;
  annualInflation: number;
  mode: DollarMode;
}): number {
  if (input.mode === "future") return input.balance;
  return inTodaysMoney(input.balance, input.age - input.currentAge, input.annualInflation);
}

/**
 * One sentence when retirement spending, after CPF LIFE, is a smaller share of
 * cash than the return left after inflation. Null when cash is missing or the
 * spending rate is not below that return.
 */
export function savingsKeepGrowingSentence(input: {
  currentAge: number;
  retirementAge: number;
  monthlyRetirementSpendingToday: number;
  annualInflation: number;
  annualReturn: number;
  cpfLifeMonthly: number;
  payoutAge: number;
  includeCpf: boolean;
  cashAtRetirement: number;
}): string | null {
  if (!(input.cashAtRetirement > 0)) return null;
  const months = Math.round(input.retirementAge * 12) - Math.round(input.currentAge * 12);
  const years = Math.max(0, months) / 12;
  const yearlySpending = input.monthlyRetirementSpendingToday * (1 + input.annualInflation) ** years * 12;
  const lifeAtRetirement =
    input.includeCpf && input.payoutAge <= input.retirementAge ? input.cpfLifeMonthly * 12 : 0;
  const spendRate = (yearlySpending - lifeAtRetirement) / input.cashAtRetirement;
  const afterInflation = realAnnualReturn(input.annualReturn, input.annualInflation);
  if (!Number.isFinite(spendRate) || !Number.isFinite(afterInflation) || !(spendRate < afterInflation)) return null;
  return `You'd spend about ${formatShare(spendRate)} of your savings a year, less than your ${formatShare(afterInflation)} return after inflation, so your savings keep growing.`;
}

function formatShare(rate: number): string {
  const text = new Intl.NumberFormat("en-SG", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rate * 100);
  return `${text}%`;
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
 * True when some working-year salary is above the ordinary wage ceiling.
 * Employee CPF is deducted either way, and the plan holds that ceiling flat.
 */
export function projectedSalaryExceedsCeiling(input: {
  currentAge: number;
  retirementAge: number;
  monthlyIncome: number;
  annualIncomeGrowth: number;
}): boolean {
  const ceiling = CPF_WAGE.ordinaryCeiling.value;
  const retirementMonth = Math.round(input.retirementAge * 12) - Math.round(input.currentAge * 12);
  for (let month = 0; month < retirementMonth; month += 1) {
    const wage = input.monthlyIncome * (1 + input.annualIncomeGrowth) ** Math.floor(month / 12);
    if (wage > ceiling) return true;
  }
  return false;
}
