import { monthlyRate, realAnnualReturn, yearsToMonths } from "./rates";

export interface RetirementInput {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentSavings: number;
  monthlyContribution: number;
  /** Annual effective return, for example 0.05 for 5%. */
  annualReturn: number;
  /** Annual effective inflation, for example 0.025 for 2.5%. */
  annualInflation: number;
  /** Desired monthly spending in today's money. */
  monthlySpendingToday: number;
  /**
   * Monthly retirement income such as CPF LIFE, in today's money.
   * Treated as keeping its purchasing power (it rises with inflation).
   * Use 0 when there is none.
   */
  monthlyRetirementIncomeToday: number;
}

export interface BalancePoint {
  age: number;
  balance: number;
  phase: "accumulation" | "drawdown";
}

export interface RetirementResult {
  valid: boolean;
  errors: string[];
  yearsToRetirement: number;
  yearsInRetirement: number;
  /** Nominal balance required when drawdown starts. */
  nestEggNeeded: number;
  /** Same nest egg, discounted back to today's prices. */
  nestEggInTodaysMoney: number;
  /** Nominal balance when drawdown starts, given the current plan. */
  projectedSavings: number;
  projectedSavingsInTodaysMoney: number;
  /** Projected savings minus the nest egg. Positive is a surplus. */
  gap: number;
  /**
   * Extra month-end contribution during the working years that closes a
   * shortfall. Zero when the plan already meets the nest egg. Null when a
   * shortfall remains and there are no contribution months left.
   */
  extraMonthlySaving: number | null;
  /** Age the balance hits zero before life expectancy, otherwise null. */
  moneyRunsOutAge: number | null;
  /** Balance at life expectancy, or 0 when savings run out first. */
  endingBalance: number;
  monthlySpendingAtRetirement: number;
  monthlyIncomeAtRetirement: number;
  realAnnualReturn: number;
  series: BalancePoint[];
}

/** Half a cent. Comparisons inside this band are treated as equal. */
const MONEY_EPS = 0.005;

export const MODEL_ASSUMPTIONS = [
  {
    title: "One steady return, compounded monthly",
    detail:
      "The annual return is an effective yearly rate. Each month the balance grows by the rate that compounds back to that year. Returns do not bounce around from year to year, so a bad sequence early in retirement is not shown.",
  },
  {
    title: "Contributions stop at retirement",
    detail:
      "Monthly contributions are added at the end of each working month. They stop when drawdown starts. If you are already retired, further monthly contributions are ignored.",
  },
  {
    title: "Spending and income are in today’s prices",
    detail:
      "Desired spending, and any CPF LIFE payout, are entered in today’s money. Both rise with inflation up to retirement and then every month after that, so they keep the same purchasing power.",
  },
  {
    title: "Withdrawals come out at the start of the month",
    detail:
      "Each retirement month, spending minus income is taken from the balance first. What remains then earns that month’s return. This is slightly more cautious than withdrawing at month end.",
  },
  {
    title: "The nest egg lasts until your planning age, with nothing left over",
    detail:
      "The nest egg is the balance, on the day drawdown starts, that reaches about zero at your life expectancy. It does not include a bequest.",
  },
  {
    title: "CPF LIFE is whatever you type",
    detail:
      "Singapore mode does not look up CPF balances, contribution rates, or official payout tables. A level CPF LIFE plan often pays a flat dollar amount. If yours will not rise with prices, enter a smaller figure so the later years are not overstated.",
  },
] as const;

function invalid(errors: string[]): RetirementResult {
  return {
    valid: false,
    errors,
    yearsToRetirement: 0,
    yearsInRetirement: 0,
    nestEggNeeded: 0,
    nestEggInTodaysMoney: 0,
    projectedSavings: 0,
    projectedSavingsInTodaysMoney: 0,
    gap: 0,
    extraMonthlySaving: null,
    moneyRunsOutAge: null,
    endingBalance: 0,
    monthlySpendingAtRetirement: 0,
    monthlyIncomeAtRetirement: 0,
    realAnnualReturn: 0,
    series: [],
  };
}

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateRetirementInput(input: RetirementInput): string[] {
  const labels: [keyof RetirementInput, string][] = [
    ["currentAge", "current age"],
    ["retirementAge", "retirement age"],
    ["lifeExpectancy", "life expectancy"],
    ["currentSavings", "current savings"],
    ["monthlyContribution", "monthly contribution"],
    ["annualReturn", "annual return"],
    ["annualInflation", "inflation"],
    ["monthlySpendingToday", "monthly spending"],
    ["monthlyRetirementIncomeToday", "monthly retirement income"],
  ];

  const errors: string[] = [];
  for (const [key, label] of labels) {
    if (!isFiniteNumber(input[key])) {
      errors.push(`Enter a number for ${label}.`);
    }
  }
  if (errors.length > 0) return errors;

  if (input.currentAge < 0 || input.currentAge > 120) {
    errors.push("Current age must be between 0 and 120.");
  }
  if (input.retirementAge < 0 || input.retirementAge > 120) {
    errors.push("Retirement age must be between 0 and 120.");
  }
  if (input.lifeExpectancy < 0 || input.lifeExpectancy > 120) {
    errors.push("Life expectancy must be between 0 and 120.");
  }

  const currentMonths = yearsToMonths(input.currentAge);
  const retirementMonths = yearsToMonths(input.retirementAge);
  const lifeMonths = yearsToMonths(input.lifeExpectancy);

  if (lifeMonths <= currentMonths) {
    errors.push("Life expectancy has to be after your current age.");
  } else if (retirementMonths > currentMonths && lifeMonths <= retirementMonths) {
    errors.push("Life expectancy has to be after the retirement age.");
  }

  if (input.currentSavings < 0) errors.push("Current savings cannot be negative.");
  if (input.monthlyContribution < 0) errors.push("Monthly contribution cannot be negative.");
  if (input.monthlySpendingToday < 0) errors.push("Monthly spending cannot be negative.");
  if (input.monthlyRetirementIncomeToday < 0) {
    errors.push("Monthly retirement income cannot be negative.");
  }
  if (input.annualReturn <= -1) errors.push("Annual return has to be greater than −100%.");
  if (input.annualInflation <= -1) errors.push("Inflation has to be greater than −100%.");

  return errors;
}

/** Closed form for month-end contributions. Exported for tests and later goals. */
export function futureValue(params: {
  startingBalance: number;
  monthlyContribution: number;
  monthlyReturn: number;
  months: number;
}): number {
  const { startingBalance, monthlyContribution, monthlyReturn, months } = params;
  if (months <= 0) return startingBalance;
  if (monthlyReturn === 0) return startingBalance + monthlyContribution * months;
  const growth = (1 + monthlyReturn) ** months;
  return startingBalance * growth + (monthlyContribution * (growth - 1)) / monthlyReturn;
}

/**
 * Balance required at the start of drawdown so opening-of-month withdrawals
 * finish at zero. Withdrawals grow by `monthlyGrowth` each month.
 */
export function nestEggForWithdrawals(params: {
  firstNetWithdrawal: number;
  monthlyReturn: number;
  monthlyGrowth: number;
  months: number;
}): number {
  const { firstNetWithdrawal, monthlyReturn, monthlyGrowth, months } = params;
  if (months <= 0 || firstNetWithdrawal <= MONEY_EPS) return 0;
  let balance = 0;
  for (let month = months - 1; month >= 0; month -= 1) {
    const withdrawal = firstNetWithdrawal * monthlyGrowth ** month;
    balance = balance / (1 + monthlyReturn) + withdrawal;
  }
  return balance;
}

export function extraMonthlyContribution(params: {
  shortfall: number;
  monthlyReturn: number;
  months: number;
}): number | null {
  const { shortfall, monthlyReturn, months } = params;
  if (shortfall <= MONEY_EPS) return 0;
  if (months <= 0) return null;
  if (monthlyReturn === 0) return shortfall / months;
  const factor = ((1 + monthlyReturn) ** months - 1) / monthlyReturn;
  return shortfall / factor;
}

export function calculateRetirement(input: RetirementInput): RetirementResult {
  const errors = validateRetirementInput(input);
  if (errors.length > 0) return invalid(errors);

  const currentMonths = yearsToMonths(input.currentAge);
  const retirementMonths = yearsToMonths(input.retirementAge);
  const lifeMonths = yearsToMonths(input.lifeExpectancy);
  const alreadyRetired = retirementMonths <= currentMonths;
  const drawdownStartMonths = alreadyRetired ? currentMonths : retirementMonths;
  const monthsToRetirement = drawdownStartMonths - currentMonths;
  const monthsInRetirement = lifeMonths - drawdownStartMonths;

  const monthlyReturn = monthlyRate(input.annualReturn);
  const monthlyGrowth = (1 + input.annualInflation) ** (1 / 12);
  const series: BalancePoint[] = [];
  let balance = input.currentSavings;

  const push = (elapsedMonths: number, phase: BalancePoint["phase"], value: number) => {
    series.push({
      age: (currentMonths + elapsedMonths) / 12,
      balance: value,
      phase,
    });
  };

  push(0, monthsToRetirement > 0 ? "accumulation" : "drawdown", balance);

  for (let month = 0; month < monthsToRetirement; month += 1) {
    balance = balance * (1 + monthlyReturn) + input.monthlyContribution;
    push(month + 1, "accumulation", balance);
  }

  const projectedSavings = balance;
  const yearsUntilDrawdown = monthsToRetirement / 12;
  const inflationToDrawdown = (1 + input.annualInflation) ** yearsUntilDrawdown;
  const monthlySpendingAtRetirement = input.monthlySpendingToday * inflationToDrawdown;
  const monthlyIncomeAtRetirement = input.monthlyRetirementIncomeToday * inflationToDrawdown;
  const firstNetWithdrawal = Math.max(0, monthlySpendingAtRetirement - monthlyIncomeAtRetirement);

  const nestEggNeeded = nestEggForWithdrawals({
    firstNetWithdrawal,
    monthlyReturn,
    monthlyGrowth,
    months: monthsInRetirement,
  });

  let spending = monthlySpendingAtRetirement;
  let income = monthlyIncomeAtRetirement;
  let moneyRunsOutAge: number | null = null;
  let endingBalance = balance;

  for (let month = 0; month < monthsInRetirement; month += 1) {
    const net = spending - income;
    if (net > balance + MONEY_EPS) {
      const fraction = net > 0 ? Math.max(balance, 0) / net : 0;
      moneyRunsOutAge = (drawdownStartMonths + month + fraction) / 12;
      balance = 0;
      endingBalance = 0;
      push(monthsToRetirement + month + fraction, "drawdown", 0);
      break;
    }

    balance = (balance - net) * (1 + monthlyReturn);
    if (balance < 0 && balance > -MONEY_EPS) balance = 0;
    endingBalance = balance;
    push(monthsToRetirement + month + 1, "drawdown", balance);
    spending *= monthlyGrowth;
    income *= monthlyGrowth;
  }

  if (!Number.isFinite(projectedSavings) || !Number.isFinite(nestEggNeeded) || !Number.isFinite(balance)) {
    return invalid([
      "These inputs produce a number too large to show. Try a lower return or a shorter horizon.",
    ]);
  }

  const gap = projectedSavings - nestEggNeeded;
  const discountYears = monthsToRetirement / 12;
  const discount = (1 + input.annualInflation) ** discountYears;

  return {
    valid: true,
    errors: [],
    yearsToRetirement: monthsToRetirement / 12,
    yearsInRetirement: monthsInRetirement / 12,
    nestEggNeeded,
    nestEggInTodaysMoney: nestEggNeeded / discount,
    projectedSavings,
    projectedSavingsInTodaysMoney: projectedSavings / discount,
    gap,
    extraMonthlySaving: extraMonthlyContribution({
      shortfall: Math.max(0, -gap),
      monthlyReturn,
      months: monthsToRetirement,
    }),
    moneyRunsOutAge,
    endingBalance,
    monthlySpendingAtRetirement,
    monthlyIncomeAtRetirement,
    realAnnualReturn: realAnnualReturn(input.annualReturn, input.annualInflation),
    series,
  };
}
