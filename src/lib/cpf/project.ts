import {
  CPF_INTEREST,
  CPF_LIFE_DEFERRAL,
  CPF_LIFE_PAYOUT_ANCHORS,
  CPF_WAGE,
  PLANNING_YEAR,
  allocationBand,
  basicHealthcareSumCap,
  calendarYearAtMonth,
  contributionBand,
  cpfLifeDeferralMultiplier,
  isInterestCreditMonth,
  ordinaryCeilingForYear,
  retirementSumsForCohort,
  yearTurning55,
} from "./constants";

export interface CpfBalances {
  oa: number;
  sa: number;
  ra: number;
  ma: number;
}

export interface CpfProjectionInput {
  currentAge: number;
  /** How many months to project. */
  months: number;
  initial: CpfBalances;
  /** Gross monthly wage at each month. Zero means no contribution. */
  wageAtMonth: (month: number) => number;
  /** Housing instalment attempted from OA at each month. */
  oaPaymentAtMonth?: (month: number) => number;
  /** Age when CPF LIFE payouts are estimated to start. Clamped to 65–70. */
  payoutAge: number;
  /**
   * Month when remaining Ordinary Account savings are moved to cash.
   * The amount includes base Ordinary Account interest already earned that
   * year and not yet credited. From that month the balance stays at zero.
   * Later base Ordinary Account interest is returned in postSweepOaCredits.
   * Extra interest is not withdrawable: it goes to the Special or Retirement
   * Account until CPF LIFE starts, and is left out after that.
   */
  withdrawOaAtMonth?: number | null;
}

export interface CpfProjection {
  balances: CpfBalances[];
  /** Part of an OA instalment OA could not cover, by month. */
  oaShortfall: number[];
  /** Level nominal CPF LIFE payout from the payout month. Estimate. */
  monthlyPayout: number;
  payoutStartMonth: number | null;
  /** Retirement Account used as the illustration base at age 65, before deferral. */
  raAt65: number;
  cohortYear: number;
  retirementSumEstimated: boolean;
  fullRetirementSum: number;
  /** True when the payout, a post-2027 retirement sum, or deferred payout factor is an estimate. */
  reliesOnEstimate: boolean;
  /**
   * Ordinary Account moved to cash, including base interest earned so far
   * that year and not yet credited. Zero when nothing is withdrawn.
   */
  oaWithdrawn: number;
  /**
   * Base Ordinary Account interest paid to cash after the sweep, by month.
   * Zero before the sweep. Extra interest is never included.
   */
  postSweepOaCredits: number[];
  /** True when a Basic Healthcare Sum in this projection is not a published figure. */
  bhsEstimated: boolean;
}

function emptyBalances(): CpfBalances {
  return { oa: 0, sa: 0, ra: 0, ma: 0 };
}

function clone(balances: CpfBalances): CpfBalances {
  return { ...balances };
}

/** SA closes at 55: SA fills RA up to FRS, and anything above FRS goes to OA. OA then tops RA up to FRS. */
export function closeSpecialAccount(balances: CpfBalances, fullRetirementSum: number): CpfBalances {
  const next = clone(balances);
  const fromSa = Math.min(next.sa, fullRetirementSum);
  next.ra += fromSa;
  next.sa -= fromSa;
  next.oa += next.sa;
  next.sa = 0;
  const shortfall = Math.max(0, fullRetirementSum - next.ra);
  const fromOa = Math.min(next.oa, shortfall);
  next.ra += fromOa;
  next.oa -= fromOa;
  return next;
}

interface ExtraSlices {
  oa: number;
  sa: number;
  ra: number;
  ma: number;
  /** Annual extra rate that applies to these slices. */
  rate: number;
}

/**
 * Extra-interest slices. OA extra interest is tracked separately so it can
 * be credited to SA (before 55) or RA (from 55), which is the published rule.
 */
export function extraInterestSlices(balances: CpfBalances, age: number): ExtraSlices[] {
  const oaCap = CPF_INTEREST.extraBelow55.ordinaryCap;
  if (age < 55) {
    let room = CPF_INTEREST.extraBelow55.firstCombined;
    const oa = Math.min(balances.oa, oaCap, room);
    room -= oa;
    const sa = Math.min(balances.sa, room);
    room -= sa;
    const ra = Math.min(balances.ra, room);
    room -= ra;
    const ma = Math.min(balances.ma, room);
    return [{ oa, sa, ra, ma, rate: CPF_INTEREST.extraBelow55.value }];
  }

  let room = CPF_INTEREST.extraFrom55.firstCombined;
  const oaFirst = Math.min(balances.oa, CPF_INTEREST.extraFrom55.ordinaryCap, room);
  room -= oaFirst;
  const saFirst = Math.min(balances.sa, room);
  room -= saFirst;
  const raFirst = Math.min(balances.ra, room);
  room -= raFirst;
  const maFirst = Math.min(balances.ma, room);

  let second = CPF_INTEREST.extraFrom55.secondCombined;
  const oaLeft = Math.max(0, balances.oa - oaFirst);
  const oaSecond = Math.min(oaLeft, Math.max(0, CPF_INTEREST.extraFrom55.ordinaryCap - oaFirst), second);
  second -= oaSecond;
  const saSecond = Math.min(Math.max(0, balances.sa - saFirst), second);
  second -= saSecond;
  const raSecond = Math.min(Math.max(0, balances.ra - raFirst), second);
  second -= raSecond;
  const maSecond = Math.min(Math.max(0, balances.ma - maFirst), second);

  return [
    { oa: oaFirst, sa: saFirst, ra: raFirst, ma: maFirst, rate: CPF_INTEREST.extraFrom55.firstTier },
    { oa: oaSecond, sa: saSecond, ra: raSecond, ma: maSecond, rate: CPF_INTEREST.extraFrom55.secondTier },
  ];
}

export function monthlyContributions(age: number, wage: number, year = PLANNING_YEAR): {
  employee: number;
  employer: number;
  total: number;
  allocation: CpfBalances;
} {
  const none = { employee: 0, employer: 0, total: 0, allocation: emptyBalances() };
  if (wage <= CPF_WAGE.fullRateAbove.value) return none;
  const capped = Math.min(wage, ordinaryCeilingForYear(year));
  const band = contributionBand(age, year);
  const total = Math.round(capped * (band.employer + band.employee));
  const employee = Math.floor(capped * band.employee);
  const employer = total - employee;
  const ratios = allocationBand(age, year);
  const ma = total * ratios.ma;
  const specialOrRetirement = total * ratios.specialOrRetirement;
  const oa = total - ma - specialOrRetirement;
  const allocation = emptyBalances();
  allocation.ma = ma;
  allocation.oa = oa;
  allocation.sa = age < 55 ? specialOrRetirement : 0;
  allocation.ra = age < 55 ? 0 : specialOrRetirement;
  return { employee, employer, total, allocation };
}

/** Linear estimate between the published 2026 Standard-plan anchors. */
export function estimateStandardPayout(raAt65: number): number {
  const points = CPF_LIFE_PAYOUT_ANCHORS.points;
  if (raAt65 <= 0) return 0;
  if (raAt65 <= points[0].raAt65) {
    return (points[0].monthlyPayout * raAt65) / points[0].raAt65;
  }
  const last = points[points.length - 1];
  if (raAt65 >= last.raAt65) {
    return (last.monthlyPayout * raAt65) / last.raAt65;
  }
  for (let index = 1; index < points.length; index += 1) {
    const right = points[index];
    const left = points[index - 1];
    if (raAt65 <= right.raAt65) {
      const t = (raAt65 - left.raAt65) / (right.raAt65 - left.raAt65);
      return left.monthlyPayout + t * (right.monthlyPayout - left.monthlyPayout);
    }
  }
  return 0;
}

function addSpecialOrRetirement(
  balances: CpfBalances,
  amount: number,
  fullRetirementSum: number,
  age: number,
): void {
  if (amount <= 0) return;
  if (age < 55) {
    balances.sa += amount;
    return;
  }
  const room = Math.max(0, fullRetirementSum - balances.ra);
  const toRa = Math.min(amount, room);
  balances.ra += toRa;
  balances.oa += amount - toRa;
}

/** MediSave above a published Basic Healthcare Sum flows out. A missing cap means do not spill. */
function spillMedisave(balances: CpfBalances, fullRetirementSum: number, age: number, cap: number | null): void {
  if (cap === null || balances.ma <= cap) return;
  const excess = balances.ma - cap;
  balances.ma = cap;
  if (age < 55) balances.sa += excess;
  else addSpecialOrRetirement(balances, excess, fullRetirementSum, age);
}

export function projectCpf(input: CpfProjectionInput): CpfProjection {
  const startMonths = Math.round(input.currentAge * 12);
  const cohortYear = yearTurning55(input.currentAge);
  const yearTurning65 = PLANNING_YEAR + Math.round(65 - input.currentAge);
  const sums = retirementSumsForCohort(cohortYear);
  const payoutAge = Math.min(
    CPF_LIFE_DEFERRAL.latestAge,
    Math.max(CPF_LIFE_DEFERRAL.earliestAge, input.payoutAge),
  );
  const balances: CpfBalances[] = [];
  const oaShortfall: number[] = [];
  let current = clone(input.initial);
  let accrued = emptyBalances();
  let accruedExtraToRetirement = 0;
  let raAt65 = currentAgeSnapshot(input.currentAge, current);
  let payout = 0;
  let payoutStartMonth: number | null = null;
  let saw65 = input.currentAge >= 65;
  let oaWithdrawn = 0;
  let oaSwept = false;
  const postSweepOaCredits: number[] = [];
  let bhsEstimated = false;

  const push = () => balances.push(clone(current));

  for (let month = 0; month < input.months; month += 1) {
    postSweepOaCredits.push(0);
    const age = (startMonths + month) / 12;
    const ageBefore = (startMonths + month - 1) / 12;
    if (month === 0 && age >= 55 && input.currentAge >= 55) {
      current = closeSpecialAccount(current, sums.frs);
    }
    if (month > 0 && ageBefore < 55 && age >= 55) {
      current = closeSpecialAccount(current, sums.frs);
    }

    const housing = Math.max(0, input.oaPaymentAtMonth?.(month) ?? 0);
    const paidFromOa = Math.min(current.oa, housing);
    current.oa -= paidFromOa;
    oaShortfall.push(housing - paidFromOa);

    const wage = Math.max(0, input.wageAtMonth(month));
    const contribution = monthlyContributions(age, wage, calendarYearAtMonth(month));
    current.oa += contribution.allocation.oa;
    current.ma += contribution.allocation.ma;
    addSpecialOrRetirement(
      current,
      contribution.allocation.sa + contribution.allocation.ra,
      sums.frs,
      age,
    );
    const healthcare = basicHealthcareSumCap({
      calendarYear: calendarYearAtMonth(month),
      age,
      yearTurning65,
    });
    if (healthcare.estimated) bhsEstimated = true;
    spillMedisave(current, sums.frs, age, healthcare.cap);

    if (input.withdrawOaAtMonth === month) {
      oaWithdrawn = current.oa + accrued.oa;
      current.oa = 0;
      accrued.oa = 0;
      oaSwept = true;
    }

    accrued.oa += (current.oa * CPF_INTEREST.ordinaryAccount.value) / 12;
    accrued.sa += (current.sa * CPF_INTEREST.specialMedisaveRetirement.value) / 12;
    accrued.ra += (current.ra * CPF_INTEREST.specialMedisaveRetirement.value) / 12;
    accrued.ma += (current.ma * CPF_INTEREST.specialMedisaveRetirement.value) / 12;
    const payoutAlreadyStarted = payoutStartMonth !== null;
    if (!payoutAlreadyStarted) {
      for (const slice of extraInterestSlices(current, age)) {
        const monthly = slice.rate / 12;
        accruedExtraToRetirement += slice.oa * monthly;
        accrued.sa += slice.sa * monthly;
        accrued.ra += slice.ra * monthly;
        accrued.ma += slice.ma * monthly;
      }
    }

    const creditNow = isInterestCreditMonth(month);
    if (creditNow) {
      if (oaSwept) postSweepOaCredits[month] += accrued.oa;
      else current.oa += accrued.oa;
      current.ma += accrued.ma;
      const extraForAccounts = payoutAlreadyStarted ? 0 : accruedExtraToRetirement;
      if (age >= 55) {
        current.ra += accrued.ra + accrued.sa + extraForAccounts;
        current.sa = 0;
      } else {
        current.sa += accrued.sa + extraForAccounts;
        current.ra += accrued.ra;
      }
      accrued = emptyBalances();
      accruedExtraToRetirement = 0;
      const healthcareAfterCredit = basicHealthcareSumCap({
        calendarYear: calendarYearAtMonth(month),
        age,
        yearTurning65,
      });
      if (healthcareAfterCredit.estimated) bhsEstimated = true;
      spillMedisave(current, sums.frs, age, healthcareAfterCredit.cap);
    }

    if (!saw65 && age >= 65) {
      raAt65 = current.ra;
      saw65 = true;
      const deferralYears = Math.max(0, payoutAge - CPF_LIFE_DEFERRAL.earliestAge);
      payout = estimateStandardPayout(raAt65) * cpfLifeDeferralMultiplier(deferralYears);
    }

    // Someone who is already 65 or older has no age-65 snapshot in this plan.
    // Use the Retirement Account they enter today, and apply deferral only for years still ahead.
    if (month === 0 && input.currentAge >= 65 && payout === 0) {
      raAt65 = current.ra;
      const yearsAhead = Math.max(0, payoutAge - input.currentAge);
      payout = estimateStandardPayout(raAt65) * cpfLifeDeferralMultiplier(yearsAhead);
      saw65 = true;
    }

    if (payoutStartMonth === null && age >= payoutAge) {
      payoutStartMonth = month;
      if (payout === 0) {
        raAt65 = current.ra;
        payout = estimateStandardPayout(current.ra);
        saw65 = true;
      }
      current.ra = 0;
      accrued.ra = 0;
    }

    push();
  }

  if (!saw65) raAt65 = current.ra;

  return {
    balances,
    oaShortfall,
    monthlyPayout: payout,
    payoutStartMonth,
    raAt65,
    cohortYear,
    retirementSumEstimated: sums.estimated,
    fullRetirementSum: sums.frs,
    reliesOnEstimate: true,
    oaWithdrawn,
    postSweepOaCredits,
    bhsEstimated,
  };
}

function currentAgeSnapshot(currentAge: number, balances: CpfBalances): number {
  return currentAge >= 65 ? balances.ra : 0;
}
