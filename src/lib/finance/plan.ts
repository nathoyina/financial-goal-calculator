import { projectCpf, monthlyContributions, type CpfBalances } from "../cpf/project";
import {
  BASIC_HEALTHCARE_SUM,
  CPF_INTEREST,
  CPF_LIFE_DEFERRAL,
  CPF_LIFE_FRS_FROM_70,
  RETIREMENT_SUM_GROWTH_ASSUMPTION,
  UNVERIFIED_CPF_ITEMS,
  calendarYearAtMonth,
  retirementSumsForCohort,
  yearTurning55,
} from "../cpf/constants";
import { educationByMonth, educationWithdrawals, type ChildEducation } from "./education";
import { amortisationSchedule, levelInstalment, type LoanInput } from "./loan";
import { formatPercent } from "./format";
import { monthlyRate } from "./rates";

export interface PlanLoan extends LoanInput {
  paidFrom: "cash" | "oa";
}

export interface PlanInput {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  cashSavings: number;
  monthlyIncome: number;
  annualIncomeGrowth: number;
  monthlyExpensesNow: number;
  monthlyRetirementSpendingToday: number;
  annualReturn: number;
  annualInflation: number;
  extraMonthlySaving: number;
  includeCpf: boolean;
  cpf: CpfBalances & { payoutAge: number };
  loan: PlanLoan | null;
  children: ChildEducation[];
}

export interface BalancePoint {
  age: number;
  balance: number;
  phase: "accumulation" | "drawdown";
}

export interface EstimateNote {
  id: string;
  title: string;
  explanation: string;
}

export interface PlanResult {
  valid: boolean;
  errors: string[];
  canRetire: boolean;
  nestEggNeeded: number;
  projectedCashAtRetirement: number;
  gap: number;
  cpfLifeMonthly: number;
  /** Further monthly cash, on top of any extra already entered, that makes the plan last. */
  extraMonthlySaving: number | null;
  /** How much to lower retirement spending, in today's prices. Null when spending cuts cannot fix it. */
  spendingCutToday: number | null;
  earliestRetirementAge: number | null;
  moneyRunsOutAge: number | null;
  endingBalance: number;
  monthlySavingToday: number;
  series: BalancePoint[];
  reliesOnEstimate: boolean;
  estimates: EstimateNote[];
  cohortYear: number;
  fullRetirementSum: number;
  retirementSumEstimated: boolean;
}

interface Simulation {
  moneyRunsOutAge: number | null;
  endingBalance: number;
  projectedCashAtRetirement: number;
  nestEggNeeded: number;
  series: BalancePoint[];
  cpfLifeMonthly: number;
  monthlySavingToday: number;
  reliesOnEstimate: boolean;
  estimates: EstimateNote[];
  cohortYear: number;
  fullRetirementSum: number;
  retirementSumEstimated: boolean;
}

const EPS = 0.005;

function invalid(errors: string[]): PlanResult {
  return {
    valid: false,
    errors,
    canRetire: false,
    nestEggNeeded: 0,
    projectedCashAtRetirement: 0,
    gap: 0,
    cpfLifeMonthly: 0,
    extraMonthlySaving: null,
    spendingCutToday: null,
    earliestRetirementAge: null,
    moneyRunsOutAge: null,
    endingBalance: 0,
    monthlySavingToday: 0,
    series: [],
    reliesOnEstimate: false,
    estimates: [],
    cohortYear: 0,
    fullRetirementSum: 0,
    retirementSumEstimated: false,
  };
}

function finite(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

export function validatePlanInput(input: PlanInput): string[] {
  const errors: string[] = [];
  const numbers: [number, string][] = [
    [input.currentAge, "current age"],
    [input.retirementAge, "retirement age"],
    [input.lifeExpectancy, "life expectancy"],
    [input.cashSavings, "cash savings"],
    [input.monthlyIncome, "monthly income"],
    [input.annualIncomeGrowth, "income growth"],
    [input.monthlyExpensesNow, "monthly expenses"],
    [input.monthlyRetirementSpendingToday, "retirement spending"],
    [input.annualReturn, "annual return"],
    [input.annualInflation, "inflation"],
    [input.extraMonthlySaving, "extra monthly saving"],
  ];
  for (const [value, label] of numbers) {
    if (!finite(value)) errors.push(`Enter a number for ${label}.`);
  }
  if (errors.length > 0) return errors;

  if (input.currentAge < 0 || input.currentAge > 120) errors.push("Current age must be between 0 and 120.");
  if (input.retirementAge < 0 || input.retirementAge > 120) {
    errors.push("Retirement age must be between 0 and 120.");
  }
  if (input.lifeExpectancy < 0 || input.lifeExpectancy > 120) {
    errors.push("Life expectancy must be between 0 and 120.");
  }
  if (input.retirementAge <= input.currentAge) {
    errors.push("Retirement age has to be after your current age.");
  }
  if (input.lifeExpectancy <= input.retirementAge) {
    errors.push("Life expectancy has to be after the retirement age.");
  }
  if (input.cashSavings < 0) errors.push("Cash savings cannot be negative.");
  if (input.monthlyIncome < 0) errors.push("Monthly income cannot be negative.");
  if (input.monthlyExpensesNow < 0) errors.push("Monthly expenses cannot be negative.");
  if (input.monthlyRetirementSpendingToday < 0) errors.push("Retirement spending cannot be negative.");
  if (input.extraMonthlySaving < 0) errors.push("Extra monthly saving cannot be negative.");
  if (input.annualReturn <= -1) errors.push("Annual return has to be greater than −100%.");
  if (input.annualInflation <= -1) errors.push("Inflation has to be greater than −100%.");
  if (input.annualIncomeGrowth <= -1) errors.push("Income growth has to be greater than −100%.");

  if (input.includeCpf) {
    for (const [value, label] of [
      [input.cpf.oa, "Ordinary Account"],
      [input.cpf.sa, "Special Account"],
      [input.cpf.ra, "Retirement Account"],
      [input.cpf.ma, "MediSave"],
    ] as const) {
      if (!finite(value) || value < 0) errors.push(`${label} cannot be negative.`);
    }
    if (input.cpf.payoutAge < CPF_LIFE_DEFERRAL.earliestAge || input.cpf.payoutAge > CPF_LIFE_DEFERRAL.latestAge) {
      errors.push("CPF LIFE payout age has to be from 65 to 70.");
    }
  }

  if (input.loan) {
    if (input.loan.balance < 0) errors.push("Loan balance cannot be negative.");
    if (input.loan.remainingMonths < 0) errors.push("Loan tenure cannot be negative.");
    if (input.loan.annualInterestRate <= -1) errors.push("Loan interest has to be greater than −100%.");
  }

  return errors;
}

function fails(simulation: Simulation): boolean {
  return simulation.moneyRunsOutAge !== null;
}

function simulate(input: PlanInput): Simulation {
  const startMonths = Math.round(input.currentAge * 12);
  const retirementMonth = Math.round(input.retirementAge * 12) - startMonths;
  const horizon = Math.round(input.lifeExpectancy * 12) - startMonths;
  const monthlyReturn = monthlyRate(input.annualReturn);
  const cohortYear = yearTurning55(input.currentAge);
  const sums = retirementSumsForCohort(cohortYear);

  const wageAtMonth = (month: number) => {
    if (month >= retirementMonth) return 0;
    const years = Math.floor(month / 12);
    return input.monthlyIncome * (1 + input.annualIncomeGrowth) ** years;
  };

  const schedule = input.loan
    ? amortisationSchedule({
        balance: input.loan.balance,
        annualInterestRate: input.loan.annualInterestRate,
        remainingMonths: input.loan.remainingMonths,
        monthlyInstalment:
          input.loan.monthlyInstalment && input.loan.monthlyInstalment > 0
            ? input.loan.monthlyInstalment
            : undefined,
      })
    : [];

  const oaLoanPastRetirement =
    input.loan?.paidFrom === "oa" && schedule.length > retirementMonth;
  const age55Month = Math.max(0, Math.round((55 - input.currentAge) * 12));
  const sweepMonth =
    input.includeCpf && !oaLoanPastRetirement ? Math.max(retirementMonth, age55Month) : null;

  const education = educationByMonth(
    educationWithdrawals({
      children: input.children,
      annualInflation: input.annualInflation,
      horizonMonths: horizon,
    }),
  );

  const cpf = input.includeCpf
    ? projectCpf({
        currentAge: input.currentAge,
        months: horizon,
        initial: {
          oa: input.cpf.oa,
          sa: input.cpf.sa,
          ra: input.cpf.ra,
          ma: input.cpf.ma,
        },
        wageAtMonth,
        oaPaymentAtMonth: (month) => (input.loan?.paidFrom === "oa" ? (schedule[month]?.payment ?? 0) : 0),
        payoutAge: input.cpf.payoutAge,
        withdrawOaAtMonth: sweepMonth,
      })
    : null;

  const estimates: EstimateNote[] = [];
  if (input.includeCpf) {
    const oaPercent = formatPercent(CPF_INTEREST.ordinaryAccount.value);
    const smraPercent = formatPercent(CPF_INTEREST.specialMedisaveRetirement.value);
    estimates.push({
      id: "cpf-life-payout",
      title: "CPF LIFE payout",
      explanation: `Scaled from CPF’s ${CPF_LIFE_FRS_FROM_70.yearTurning55} illustrative Standard-plan payouts for a male member, not a personal quote. ${UNVERIFIED_CPF_ITEMS.cohort2026PayoutRanges.note} The payout is kept flat in dollar terms. If payouts start while you are still working, they are added to cash. A member who is already 65 or older is estimated from the Retirement Account entered today.`,
    });
    estimates.push({
      id: "cpf-interest",
      title: "CPF interest",
      explanation: `Ordinary Account ${oaPercent} and Special, MediSave and Retirement Account ${smraPercent} are the 1 October to 31 December ${CPF_INTEREST.ordinaryAccount.year} floor rates. The ${smraPercent} floor is committed through ${CPF_INTEREST.specialMedisaveRetirement.floorThroughLabel}. This plan keeps both rates for every later year and labels that as an estimate. Interest is computed on each month’s balance and credited at the end of December, which is how CPF’s Home Purchase Planner projects it. It is not compounded monthly.`,
    });
    estimates.push({
      id: "escalating-plan-start",
      title: "Escalating plan",
      explanation: UNVERIFIED_CPF_ITEMS.escalatingPlanStartDiscount.note,
    });
    if (sums.estimated && cohortYear > RETIREMENT_SUM_GROWTH_ASSUMPTION.afterYearTurning55) {
      estimates.push({
        id: "retirement-sum",
        title: "Retirement sum",
        explanation: `Assumption. CPF has published retirement sums through ${RETIREMENT_SUM_GROWTH_ASSUMPTION.afterYearTurning55}. This plan grows the ${RETIREMENT_SUM_GROWTH_ASSUMPTION.afterYearTurning55} Basic Retirement Sum by ${formatPercent(RETIREMENT_SUM_GROWTH_ASSUMPTION.annual)} a year and rounds to the nearest $${RETIREMENT_SUM_GROWTH_ASSUMPTION.roundTo.toLocaleString("en-SG")}. For someone turning 55 in ${cohortYear}, the Full Retirement Sum used here is $${sums.frs.toLocaleString("en-SG")}.`,
      });
    } else if (sums.estimated && cohortYear === 2021) {
      estimates.push({
        id: "retirement-sum",
        title: "Retirement sum",
        explanation: `The 2021 Basic Retirement Sum of $${sums.brs.toLocaleString("en-SG")} comes from news coverage, not an official CPF or MOM page, so it is labelled an estimate. The Full Retirement Sum used here is $${sums.frs.toLocaleString("en-SG")}.`,
      });
    } else if (sums.estimated) {
      estimates.push({
        id: "retirement-sum",
        title: "Retirement sum",
        explanation: `The earliest official Basic Retirement Sum in this plan is the ${sums.yearUsed} figure. This plan uses that year’s Full Retirement Sum of $${sums.frs.toLocaleString("en-SG")} for a member who turned 55 in ${cohortYear}, and labels it an estimate.`,
      });
    }
    if (cpf?.bhsEstimated) {
      estimates.push({
        id: "basic-healthcare-sum",
        title: "Basic Healthcare Sum",
        explanation:
          "CPF has published the Basic Healthcare Sum through 2026 (S$79,000). Later years are not published, so this plan does not guess a higher cap and does not keep spilling MediSave at the 2026 figure. Extra MediSave stays in MediSave in those years instead of moving into the Retirement Account.",
      });
    }
    if (input.cpf.payoutAge > CPF_LIFE_DEFERRAL.earliestAge) {
      estimates.push({
        id: "cpf-deferral",
        title: "Deferred payout",
        explanation: `CPF says each year you defer CPF LIFE past ${CPF_LIFE_DEFERRAL.earliestAge} raises payouts by up to ${formatPercent(CPF_LIFE_DEFERRAL.perYear)}, and deferring to ${CPF_LIFE_DEFERRAL.latestAge} raises them by up to ${formatPercent(CPF_LIFE_DEFERRAL.maxIncrease)}. That ${formatPercent(CPF_LIFE_DEFERRAL.maxIncrease)} is ${formatPercent(CPF_LIFE_DEFERRAL.perYear)} times ${CPF_LIFE_DEFERRAL.maxYears} years, not compound growth. This plan uses that ceiling. CPF’s illustration for the ${CPF_LIFE_FRS_FROM_70.yearTurning55} Full Retirement Sum starting at ${CPF_LIFE_FRS_FROM_70.payoutAge} is $${CPF_LIFE_FRS_FROM_70.monthlyPayout.toLocaleString("en-SG")} a month, which is lower.`,
      });
    }
  }
  if (input.includeCpf || input.loan) {
    estimates.push({
      id: "housing-accrued-interest",
      title: "Housing accrued interest",
      explanation: UNVERIFIED_CPF_ITEMS.housingAccruedInterestRate.note,
    });
  }

  const series: BalancePoint[] = [];
  let balance = input.cashSavings;
  let moneyRunsOutAge: number | null = null;
  let swept = false;
  let projectedCashAtRetirement = 0;

  const retirementNeeds: number[] = [];
  for (let month = Math.max(0, retirementMonth); month < horizon; month += 1) {
    const inflated = (1 + input.annualInflation) ** (month / 12);
    const cpfLife =
      cpf && cpf.payoutStartMonth !== null && month >= cpf.payoutStartMonth ? cpf.monthlyPayout : 0;
    const sweep = sweepMonth === month && cpf ? cpf.oaWithdrawn : 0;
    const spendingNeed =
      input.monthlyRetirementSpendingToday * inflated -
      cpfLife +
      (education.get(month) ?? 0) +
      (input.loan?.paidFrom === "cash" ? (schedule[month]?.payment ?? 0) : 0) +
      (cpf?.oaShortfall[month] ?? 0);
    // A sweep on the retirement month is already inside projected cash.
    // A later sweep, when retirement is before 55, reduces the nest egg instead.
    retirementNeeds.push(month === retirementMonth ? spendingNeed : spendingNeed - sweep);
  }

  const ageAt = (month: number) => (startMonths + month) / 12;
  series.push({
    age: input.currentAge,
    balance,
    phase: retirementMonth > 0 ? "accumulation" : "drawdown",
  });

  for (let month = 0; month < horizon; month += 1) {
    const age = ageAt(month);
    const working = month < retirementMonth;
    const inflated = (1 + input.annualInflation) ** (month / 12);
    const educationCost = education.get(month) ?? 0;
    const cashLoan = input.loan?.paidFrom === "cash" ? (schedule[month]?.payment ?? 0) : 0;
    const oaShortfall = cpf?.oaShortfall[month] ?? 0;
    const cpfLife =
      cpf && cpf.payoutStartMonth !== null && month >= cpf.payoutStartMonth ? cpf.monthlyPayout : 0;
    const wage = wageAtMonth(month);
    const employeeCpf = input.includeCpf ? monthlyContributions(age, wage, calendarYearAtMonth(month)).employee : 0;
    const sweepIncome = sweepMonth === month && cpf && !swept ? cpf.oaWithdrawn : 0;
    if (sweepMonth === month && cpf) swept = true;

    if (!working) {
      if (sweepIncome > 0) balance += sweepIncome;
      if (month === retirementMonth) projectedCashAtRetirement = balance;
      const need =
        input.monthlyRetirementSpendingToday * inflated -
        cpfLife +
        educationCost +
        cashLoan +
        oaShortfall;
      if (need > balance + EPS) {
        const fraction = need > 0 ? Math.max(balance, 0) / need : 0;
        moneyRunsOutAge = ageAt(month + fraction);
        balance = 0;
        series.push({ age: moneyRunsOutAge, balance: 0, phase: "drawdown" });
        break;
      }
      balance = (balance - need) * (1 + monthlyReturn);
      if (balance < 0 && balance > -EPS) balance = 0;
      series.push({ age: ageAt(month + 1), balance, phase: "drawdown" });
      continue;
    }

    const net =
      wage -
      employeeCpf -
      input.monthlyExpensesNow * inflated -
      educationCost -
      cashLoan -
      oaShortfall +
      input.extraMonthlySaving +
      cpfLife;
    const grown = balance * (1 + monthlyReturn);
    if (net < 0 && grown + net < -EPS) {
      moneyRunsOutAge = ageAt(month + 1);
      balance = 0;
      series.push({ age: moneyRunsOutAge, balance: 0, phase: "accumulation" });
      break;
    }
    balance = Math.max(0, grown + net);
    series.push({ age: ageAt(month + 1), balance, phase: "accumulation" });
  }

  let nestEggNeeded = 0;
  for (let index = retirementNeeds.length - 1; index >= 0; index -= 1) {
    nestEggNeeded = nestEggNeeded / (1 + monthlyReturn) + retirementNeeds[index];
  }
  nestEggNeeded = Math.max(0, nestEggNeeded);

  if (moneyRunsOutAge !== null && moneyRunsOutAge < input.retirementAge) {
    projectedCashAtRetirement = 0;
  }

  const firstLoan = input.loan?.paidFrom === "cash" ? (schedule[0]?.payment ?? 0) : 0;
  const employeeNow = input.includeCpf
    ? monthlyContributions(input.currentAge, input.monthlyIncome, calendarYearAtMonth(0)).employee
    : 0;
  const lifeAlreadyPaying = cpf?.payoutStartMonth === 0 ? cpf.monthlyPayout : 0;
  const monthlySavingToday =
    input.monthlyIncome -
    employeeNow -
    input.monthlyExpensesNow -
    firstLoan +
    input.extraMonthlySaving +
    lifeAlreadyPaying;

  return {
    moneyRunsOutAge,
    endingBalance: balance,
    projectedCashAtRetirement,
    nestEggNeeded,
    series,
    cpfLifeMonthly: cpf?.monthlyPayout ?? 0,
    monthlySavingToday,
    reliesOnEstimate: input.includeCpf || input.loan !== null,
    estimates,
    cohortYear,
    fullRetirementSum: input.includeCpf ? sums.frs : 0,
    retirementSumEstimated: input.includeCpf && sums.estimated,
  };
}

function withExtra(input: PlanInput, extra: number): PlanInput {
  return { ...input, extraMonthlySaving: input.extraMonthlySaving + extra };
}

function minimumExtra(input: PlanInput): number | null {
  if (!fails(simulate(input))) return 0;
  let low = 0;
  let high = 100_000;
  if (fails(simulate(withExtra(input, high)))) return null;
  for (let step = 0; step < 22; step += 1) {
    const mid = (low + high) / 2;
    if (fails(simulate(withExtra(input, mid)))) low = mid;
    else high = mid;
  }
  return high;
}

function spendingCut(input: PlanInput): number | null {
  const affordable = (spending: number) =>
    !fails(simulate({ ...input, monthlyRetirementSpendingToday: spending }));
  if (affordable(input.monthlyRetirementSpendingToday)) return 0;
  if (!affordable(0)) return null;
  let low = 0;
  let high = input.monthlyRetirementSpendingToday;
  for (let step = 0; step < 22; step += 1) {
    const mid = (low + high) / 2;
    if (affordable(mid)) low = mid;
    else high = mid;
  }
  return input.monthlyRetirementSpendingToday - low;
}

function earliestAge(input: PlanInput): number | null {
  const first = Math.floor(input.currentAge) + 1;
  const last = Math.ceil(input.lifeExpectancy) - 1;
  for (let age = first; age <= last; age += 1) {
    if (age <= input.currentAge || age >= input.lifeExpectancy) continue;
    if (!fails(simulate({ ...input, retirementAge: age }))) return age;
  }
  return null;
}

export function calculatePlan(input: PlanInput): PlanResult {
  const errors = validatePlanInput(input);
  if (errors.length > 0) return invalid(errors);

  const base = simulate(input);
  const gap = base.projectedCashAtRetirement - base.nestEggNeeded;
  const canRetire = base.moneyRunsOutAge === null;

  return {
    valid: true,
    errors: [],
    canRetire,
    nestEggNeeded: base.nestEggNeeded,
    projectedCashAtRetirement: base.projectedCashAtRetirement,
    gap,
    cpfLifeMonthly: base.cpfLifeMonthly,
    extraMonthlySaving: canRetire ? 0 : minimumExtra(input),
    spendingCutToday: canRetire ? 0 : spendingCut(input),
    earliestRetirementAge: canRetire ? null : earliestAge(input),
    moneyRunsOutAge: base.moneyRunsOutAge,
    endingBalance: base.endingBalance,
    monthlySavingToday: base.monthlySavingToday,
    series: base.series,
    reliesOnEstimate: base.reliesOnEstimate,
    estimates: base.estimates,
    cohortYear: base.cohortYear,
    fullRetirementSum: base.fullRetirementSum,
    retirementSumEstimated: base.retirementSumEstimated,
  };
}

/** Words for the verdict card. Null when no figure in the result is an estimate. */
export function estimateNotice(result: Pick<PlanResult, "reliesOnEstimate" | "estimates" | "cohortYear">): string | null {
  if (!result.reliesOnEstimate) return null;
  const ids = new Set(result.estimates.map((note) => note.id));
  const sentences = ["Part of this result depends on an estimate."];
  if (ids.has("retirement-sum") && result.cohortYear > 2027) {
    sentences.push("The retirement sum after 2027 is an assumption, not a published CPF figure.");
  }
  if (ids.has("retirement-sum") && result.cohortYear < 2017) {
    sentences.push("The retirement sum for this cohort uses the 2017 figures, the earliest official year cited here.");
  }
  if (ids.has("retirement-sum") && result.cohortYear === 2021) {
    sentences.push("The 2021 retirement sum comes from news coverage, so it is labelled an estimate.");
  }
  if (ids.has("cpf-life-payout")) {
    sentences.push("The 2026 CPF LIFE payout ranges were not published, so that payout is an estimate.");
  }
  if (ids.has("basic-healthcare-sum")) {
    sentences.push("The Basic Healthcare Sum after 2026 is not published, so extra MediSave is not moved into the Retirement Account in those years.");
  }
  return sentences.join(" ");
}

export function todayInstalment(loan: PlanLoan): number {
  if (loan.monthlyInstalment && loan.monthlyInstalment > 0) return loan.monthlyInstalment;
  return levelInstalment(loan.balance, loan.annualInterestRate, loan.remainingMonths);
}

export const BHS_NOTE = BASIC_HEALTHCARE_SUM;
