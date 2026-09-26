/**
 * CPF figures used by the planner.
 *
 * Checked against cpf.gov.sg on 26 September 2026. Each value carries the
 * year it applies to and the page it came from. Do not copy new numbers
 * into components; change them here.
 *
 * Rates are reviewed on CPF's own schedule. This file holds them flat for
 * the whole projection and the UI marks that as an estimate.
 */

export const CPF_CONSTANTS_AS_OF = "2026-09-26";

export interface CitedValue<T> {
  value: T;
  year: number;
  source: string;
}

/**
 * Floor rates for 1 October 2026 to 31 December 2026.
 * The 4% SMRA floor is committed through 31 December 2027 (22 September 2026 release).
 */
export const CPF_INTEREST_SOURCE =
  "https://www.cpf.gov.sg/member/infohub/news/news-releases/government-extends-4-per-cent-interest-rate-floor-on-special-medisave-and-retirement-account-monies-until-31-december-2027";

export const CPF_INTEREST = {
  ordinaryAccount: {
    value: 0.025,
    year: 2026,
    source: CPF_INTEREST_SOURCE,
  },
  specialMedisaveRetirement: {
    value: 0.04,
    year: 2026,
    floorThrough: "2027-12-31",
    floorThroughLabel: "31 December 2027",
    source: CPF_INTEREST_SOURCE,
  },
  /** HDB concessionary housing loan rate, 0.1 percentage point above the OA floor. */
  hdbConcessionary: {
    value: 0.026,
    year: 2026,
    source: CPF_INTEREST_SOURCE,
  },
  /** Extra 1% on the first $60,000 combined, OA capped at $20,000, for members below 55. */
  extraBelow55: {
    value: 0.01,
    firstCombined: 60_000,
    ordinaryCap: 20_000,
    year: 2026,
    source: CPF_INTEREST_SOURCE,
  },
  /** From 55: extra 2% on the first $30,000 (OA capped at $20,000) and extra 1% on the next $30,000. */
  extraFrom55: {
    firstTier: 0.02,
    firstCombined: 30_000,
    secondTier: 0.01,
    secondCombined: 30_000,
    ordinaryCap: 20_000,
    year: 2026,
    source: CPF_INTEREST_SOURCE,
  },
} as const;

export const CPF_CONTRIBUTION_PDF_2026 =
  "https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFcontributionratesfrom1Jan2026.pdf";

export const CPF_CONTRIBUTION_PDF_2027 =
  "https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/jan2027cpfcontributionrates.pdf";

export const CPF_CONTRIBUTION_NEWS_2027 =
  "https://www.cpf.gov.sg/employer/infohub/news/cpf-related-announcements/new-contribution-rates";

export const CPF_ALLOCATION_PDF_2026 =
  "https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFAllocationRatesfromJanuary2026.pdf";

export const CPF_ALLOCATION_PDF_2027 =
  "https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/jan2027cpfallocationrates.pdf";

/**
 * Ordinary wages are capped per month. The annual ceiling covers ordinary
 * plus additional wages. This planner only has a monthly wage, so additional
 * wages are not modelled and the annual ceiling is recorded but not applied.
 */
export const CPF_WAGE = {
  ordinaryCeiling: {
    value: 8_000,
    year: 2026,
    alsoYear: 2027,
    source: CPF_CONTRIBUTION_PDF_2026,
  },
  /** 2025 ceiling, kept so a pre-2026 year is not silently given the 2026 cap. */
  ordinaryCeiling2025: {
    value: 7_400,
    year: 2025,
    source: CPF_CONTRIBUTION_PDF_2026,
  },
  annualCeiling: {
    value: 102_000,
    year: 2026,
    source: CPF_CONTRIBUTION_PDF_2026,
    note: "Additional-wage ceiling equals this amount minus ordinary wages for the year. Not applied here.",
  },
  fullRateAbove: {
    value: 750,
    year: 2026,
    source: "https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay",
  },
} as const;

export interface ContributionBand {
  /** Inclusive upper age. "55 and below" is 55. "Above 55 to 60" is 60. */
  maxAge: number;
  employer: number;
  employee: number;
}

export interface ContributionSchedule {
  year: number;
  source: string;
  bands: ContributionBand[];
}

/**
 * Singapore citizens and SPRs from the third year, monthly wages above $750.
 * A new band starts the month after the birthday, which these max ages match:
 * the birthday month is still on the younger band.
 * After 2027 the plan keeps the 2027 table and labels that as an estimate.
 */
export const CPF_CONTRIBUTION_SCHEDULES: ContributionSchedule[] = [
  {
    year: 2026,
    source: CPF_CONTRIBUTION_PDF_2026,
    bands: [
      { maxAge: 55, employer: 0.17, employee: 0.2 },
      { maxAge: 60, employer: 0.16, employee: 0.18 },
      { maxAge: 65, employer: 0.125, employee: 0.125 },
      { maxAge: 70, employer: 0.09, employee: 0.075 },
      { maxAge: Infinity, employer: 0.075, employee: 0.05 },
    ],
  },
  {
    year: 2027,
    source: CPF_CONTRIBUTION_PDF_2027,
    bands: [
      { maxAge: 55, employer: 0.17, employee: 0.2 },
      { maxAge: 60, employer: 0.165, employee: 0.19 },
      { maxAge: 65, employer: 0.13, employee: 0.13 },
      { maxAge: 70, employer: 0.09, employee: 0.075 },
      { maxAge: Infinity, employer: 0.075, employee: 0.05 },
    ],
  },
];

/** 2026 table. Prefer contributionBand(age, year) when the calendar year is known. */
export const CPF_CONTRIBUTION_BANDS: ContributionBand[] = CPF_CONTRIBUTION_SCHEDULES[0].bands;

export const CPF_CONTRIBUTION_SOURCE = CPF_CONTRIBUTION_PDF_2026;

export interface AllocationBand {
  maxAge: number;
  /** Ratio of the total contribution, not of the wage. MediSave is applied first, then SA/RA, and OA gets the rest. */
  ma: number;
  specialOrRetirement: number;
  oa: number;
}

export interface AllocationSchedule {
  year: number;
  source: string;
  bands: AllocationBand[];
}

const ALLOCATION_THROUGH_55: AllocationBand[] = [
  { maxAge: 35, oa: 0.6217, specialOrRetirement: 0.1621, ma: 0.2162 },
  { maxAge: 45, oa: 0.5677, specialOrRetirement: 0.1891, ma: 0.2432 },
  { maxAge: 50, oa: 0.5136, specialOrRetirement: 0.2162, ma: 0.2702 },
  { maxAge: 55, oa: 0.4055, specialOrRetirement: 0.3108, ma: 0.2837 },
];

/**
 * Allocation ratios of the contribution. MediSave is applied first, then
 * SA or RA, and OA gets the remainder. The 2027 senior increase is allocated
 * to RA, so the above-55 ratios change in 2027. Ages 55 and below do not.
 */
export const CPF_ALLOCATION_SCHEDULES: AllocationSchedule[] = [
  {
    year: 2026,
    source: CPF_ALLOCATION_PDF_2026,
    bands: [
      ...ALLOCATION_THROUGH_55,
      { maxAge: 60, oa: 0.353, specialOrRetirement: 0.3382, ma: 0.3088 },
      { maxAge: 65, oa: 0.14, specialOrRetirement: 0.44, ma: 0.42 },
      { maxAge: 70, oa: 0.0607, specialOrRetirement: 0.303, ma: 0.6363 },
      { maxAge: Infinity, oa: 0.08, specialOrRetirement: 0.08, ma: 0.84 },
    ],
  },
  {
    year: 2027,
    source: CPF_ALLOCATION_PDF_2027,
    bands: [
      ...ALLOCATION_THROUGH_55,
      { maxAge: 60, oa: 0.3382, specialOrRetirement: 0.3661, ma: 0.2957 },
      { maxAge: 65, oa: 0.1347, specialOrRetirement: 0.4615, ma: 0.4038 },
      { maxAge: 70, oa: 0.0607, specialOrRetirement: 0.303, ma: 0.6363 },
      { maxAge: Infinity, oa: 0.08, specialOrRetirement: 0.08, ma: 0.84 },
    ],
  },
];

/** 2026 table. Prefer allocationBand(age, year) when the calendar year is known. */
export const CPF_ALLOCATION_BANDS: AllocationBand[] = CPF_ALLOCATION_SCHEDULES[0].bands;

export const CPF_ALLOCATION_SOURCE = CPF_ALLOCATION_PDF_2026;

export interface RetirementSumYear {
  /** Calendar year the member turns 55. BRS and FRS stay fixed for that cohort. */
  yearTurning55: number;
  brs: number;
  source: string;
  /** True when this BRS is not on an official CPF or MOM page. */
  estimated: boolean;
}

/** CPF’s own table for members who turned 55 in 2017 to 2020. */
export const RETIREMENT_SUM_SOURCE_2017_2020 =
  "https://www.cpf.gov.sg/content/dam/web/member/general-documents/Retirement%20Sums.pdf";

/** MOM Budget 2022 factsheet, used for members turning 55 in 2022 to 2024. */
export const RETIREMENT_SUM_SOURCE_2022_2024 =
  "https://www.mom.gov.sg/-/media/mom/documents/budget2022/factsheet-on-basic-retirement-sums-for-cpf-members-reaching-age-55-from-2023-to-2027.pdf/1000";

export const RETIREMENT_SUM_SOURCE_2025_2027 =
  "https://www.cpf.gov.sg/member/infohub/educational-resources/what-is-the-cpf-retirement-sum";

/**
 * 2021 is in news coverage only. The 26 Sep 2026 reference names AsiaOne and
 * does not give a page URL, so none is stored here.
 */
export const RETIREMENT_SUM_2021_SOURCE =
  "News coverage only. Not on an official CPF or MOM page in the 26 September 2026 check.";

/**
 * Cohort Basic and Full Retirement Sums. FRS is 2 x BRS. The Enhanced
 * Retirement Sum is not stored here: it is the current year’s top-up limit.
 * A year before 2017 uses the 2017 row and must be labelled an estimate.
 * 2021 must be labelled an estimate. Sums after 2027 are not published.
 */
export const PUBLISHED_RETIREMENT_SUMS: RetirementSumYear[] = [
  { yearTurning55: 2017, brs: 83_000, estimated: false, source: RETIREMENT_SUM_SOURCE_2017_2020 },
  { yearTurning55: 2018, brs: 85_500, estimated: false, source: RETIREMENT_SUM_SOURCE_2017_2020 },
  { yearTurning55: 2019, brs: 88_000, estimated: false, source: RETIREMENT_SUM_SOURCE_2017_2020 },
  { yearTurning55: 2020, brs: 90_500, estimated: false, source: RETIREMENT_SUM_SOURCE_2017_2020 },
  { yearTurning55: 2021, brs: 93_000, estimated: true, source: RETIREMENT_SUM_2021_SOURCE },
  { yearTurning55: 2022, brs: 96_000, estimated: false, source: RETIREMENT_SUM_SOURCE_2022_2024 },
  { yearTurning55: 2023, brs: 99_400, estimated: false, source: RETIREMENT_SUM_SOURCE_2022_2024 },
  { yearTurning55: 2024, brs: 102_900, estimated: false, source: RETIREMENT_SUM_SOURCE_2022_2024 },
  { yearTurning55: 2025, brs: 106_500, estimated: false, source: RETIREMENT_SUM_SOURCE_2025_2027 },
  { yearTurning55: 2026, brs: 110_200, estimated: false, source: RETIREMENT_SUM_SOURCE_2025_2027 },
  { yearTurning55: 2027, brs: 114_100, estimated: false, source: RETIREMENT_SUM_SOURCE_2025_2027 },
];

/**
 * Top-up limit for the current year. It is not fixed by the year a member
 * turned 55, and it is not 4 x an older cohort’s Basic Retirement Sum.
 */
export const ENHANCED_RETIREMENT_SUM = {
  value: 440_800,
  year: 2026,
  source: RETIREMENT_SUM_SOURCE_2025_2027,
  note: "The 2026 Enhanced Retirement Sum is the top-up limit for this year. A later year’s limit is not published here, so the plan does not invent one.",
} as const;

/**
 * 2025 to 2027 Basic Retirement Sums rose by about 3.5% a year
 * (110,200 / 106,500 ≈ 3.47%, 114,100 / 110,200 ≈ 3.54%).
 * Later cohorts grow the 2027 BRS at 3.5%, rounded to the nearest $100.
 * That growth is an assumption and must be labelled.
 */
export const RETIREMENT_SUM_GROWTH_ASSUMPTION = {
  annual: 0.035,
  afterYearTurning55: 2027,
  roundTo: 100,
  estimated: true,
  source: "https://www.cpf.gov.sg/member/infohub/educational-resources/what-is-the-cpf-retirement-sum",
  note: "Assumption. CPF has not published retirement sums after the 2027 cohort.",
} as const;

export const RETIREMENT_SUM_SOURCE =
  "https://www.cpf.gov.sg/member/infohub/educational-resources/how-the-cpf-retirement-sum-affects-your-payouts";

/**
 * For members turning 55 in 2025 or later, that calendar year’s published
 * Enhanced Retirement Sum is 4 x that year’s Basic Retirement Sum. Do not
 * apply this to an earlier cohort. This plan uses ENHANCED_RETIREMENT_SUM,
 * the 2026 top-up limit, instead of a multiple of an older Basic Retirement Sum.
 */
export const ERS_MULTIPLE_OF_BRS = {
  value: 4,
  sinceYear: 2025,
  source: "https://www.cpf.gov.sg/member/infohub/educational-resources/what-is-the-cpf-retirement-sum",
} as const;

/**
 * Illustrative Standard plan payouts for a male member who sets aside the
 * 2026 retirement sum at 55. CPF presents these as estimates, using 6% a
 * year in the illustration. They are not a personal quote.
 */
export const CPF_LIFE_PAYOUT_ANCHORS = {
  yearTurning55: 2026,
  plan: "Standard",
  points: [
    { label: "BRS", setAsideAt55: 110_200, raAt65: 170_200, monthlyPayout: 950 },
    { label: "FRS", setAsideAt55: 220_400, raAt65: 330_100, monthlyPayout: 1_780 },
    { label: "ERS", setAsideAt55: 440_800, raAt65: 650_100, monthlyPayout: 3_440 },
  ],
  source: RETIREMENT_SUM_SOURCE,
} as const;

export const CPF_LIFE_SOURCE = "https://www.cpf.gov.sg/member/retirement-income/monthly-payouts/cpf-life";

export const CPF_LIFE_EXAMPLES_PDF =
  "https://www.cpf.gov.sg/content/dam/web/member/retirement-income/documents/CPF_LIFE_Payout_Examples.pdf";

/**
 * CPF says payouts rise by up to 7% for each year they are deferred, and by
 * up to 35% if deferred to 70. 35% is 7% times five years, not compound.
 * Using the ceiling is an estimate. CPF’s own FRS-at-70 illustration is lower.
 */
export const CPF_LIFE_DEFERRAL = {
  perYear: 0.07,
  maxYears: 5,
  maxIncrease: 0.35,
  earliestAge: 65,
  latestAge: 70,
  source: CPF_LIFE_SOURCE,
  note: "Estimate. This plan uses the 7% ceiling. It is not compound, and it is above CPF’s illustration.",
} as const;

/** Male member, 2026 FRS, Standard plan, payouts from 70. CPF illustration, below the 35% ceiling. */
export const CPF_LIFE_FRS_FROM_70 = {
  monthlyPayout: 2_380,
  payoutAge: 70,
  yearTurning55: 2026,
  plan: "Standard",
  source: CPF_LIFE_EXAMPLES_PDF,
  estimated: true,
} as const;

/**
 * Figures the 26 September 2026 check could not confirm on cpf.gov.sg.
 * The UI must show each of these as an estimate. Do not invent the number.
 */
export const UNVERIFIED_CPF_ITEMS = {
  cohort2026PayoutRanges: {
    estimated: true,
    note: "Official CPF LIFE payout ranges are published for the 2025 cohort only (BRS S$860–S$930, FRS S$1,610–S$1,730, ERS S$3,100–S$3,330). 2026 cohort ranges were not on cpf.gov.sg on 26 September 2026. This plan uses the 2026 male Standard-plan illustration instead.",
    source: CPF_LIFE_EXAMPLES_PDF,
  },
  escalatingPlanStartDiscount: {
    estimated: true,
    notApplied: true,
    note: "The Escalating plan starts lower than Standard and then rises by about 2% a year. The size of that starting discount was not published, so this plan does not model the Escalating plan. Standard payouts stay level in dollar terms.",
    source: CPF_LIFE_SOURCE,
  },
  housingAccruedInterestRate: {
    estimated: true,
    notApplied: true,
    note: "Selling a home bought with CPF means refunding the principal plus accrued interest. Whether that interest uses the Ordinary Account rate was not confirmed on 26 September 2026. This plan does not charge it. Enter your own housing loan rate.",
    source: "https://www.cpf.gov.sg/member/infohub/educational-resources/how-much-cpf-savings-you-can-use-for-your-home-purchase",
  },
} as const;

/** Optional withdrawal at 55 when the Full Retirement Sum is not met. Not taken out of the RA in this plan. */
export const WITHDRAWAL_IF_BELOW_FRS = {
  value: 5_000,
  sinceYear: 2025,
  source: "https://www.cpf.gov.sg/member/retirement-income/milestones/reaching-age-55",
  note: "You may withdraw up to this amount at 55 if the Full Retirement Sum is not set aside. This plan leaves it in the Retirement Account so it can support CPF LIFE.",
} as const;

export const BHS_SOURCE_2023 =
  "https://www.cpf.gov.sg/member/infohub/news/news-releases/cpf-interest-rates-from-1-january-2023-to-31-march-2023-and-basic-healthcare-sum-for-2023";

export const BHS_SOURCE_2024 =
  "https://www.cpf.gov.sg/member/infohub/news/news-releases/cpf-interest-rates-from-1-january-2024-to-31-march-2024-and-basic-healthcare-sum-for-2024";

export const BHS_SOURCE_2025 =
  "https://www.cpf.gov.sg/member/infohub/news/news-releases/cpf-interest-rates-from-1-january-to-31-march-2025-and-basic-healthcare-sum-for-2025";

export const BHS_SOURCE_2026 =
  "https://www.cpf.gov.sg/member/infohub/news/news-releases/cpf-interest-rates-from-1-january-to-31-march-2026-and-basic-healthcare-sum-for-2026";

/**
 * Basic Healthcare Sum by calendar year, for members under 65, and the cap
 * fixed for life for members who turn 65 in that year. 2022 is the figure
 * the 2023 release says the sum was raised from. Years after 2026 are not
 * published; the projection does not invent them.
 */
export const PUBLISHED_BASIC_HEALTHCARE_SUMS = [
  { year: 2022, value: 66_000, source: BHS_SOURCE_2023 },
  { year: 2023, value: 68_500, source: BHS_SOURCE_2023 },
  { year: 2024, value: 71_500, source: BHS_SOURCE_2024 },
  { year: 2025, value: 75_500, source: BHS_SOURCE_2025 },
  { year: 2026, value: 79_000, source: BHS_SOURCE_2026 },
] as const;

export const BASIC_HEALTHCARE_SUM = {
  value: 79_000,
  year: 2026,
  source: BHS_SOURCE_2026,
  note: "Applies in 2026 to members below 65, and is fixed for members who turn 65 in 2026. Later years are not published. The plan does not keep using this cap after 2026.",
} as const;

/** Home Purchase Planner: interest is calculated monthly and credited at the end of December. */
export const CPF_INTEREST_CREDIT = {
  month: "December",
  source: "https://www.cpf.gov.sg/member/tools-and-services/planners/home-purchase",
  note: "Credited at the end of December. Computed on each month’s balance, not compounded monthly.",
} as const;

export const PLANNING_YEAR = 2026;

function scheduleForYear<T extends { year: number }>(schedules: readonly T[], year: number): T {
  let chosen = schedules[0];
  for (const schedule of schedules) {
    if (schedule.year <= year) chosen = schedule;
  }
  return chosen;
}

/** September 2026 is month 0, so January 2027 is month 4 and December 2026 is month 3. */
export function calendarYearAtMonth(monthFromNow: number, asOf = CPF_CONSTANTS_AS_OF): number {
  const [yearText, monthText] = asOf.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  return year + Math.floor((monthIndex + monthFromNow) / 12);
}

/** True on the December of the projection, which is when CPF’s planner credits interest. */
export function isInterestCreditMonth(monthFromNow: number, asOf = CPF_CONSTANTS_AS_OF): boolean {
  const monthIndex = Number(asOf.split("-")[1]) - 1;
  return (monthIndex + monthFromNow) % 12 === 11;
}

export interface HealthcareSumCap {
  /** Null when that year’s Basic Healthcare Sum is not published. Do not invent one. */
  cap: number | null;
  estimated: boolean;
  yearUsed: number | null;
}

/**
 * Cap that applies this month. Under 65, use the published sum for the
 * calendar year. From 65, use the sum for the year the member turned 65.
 * A year before the first cited figure falls back to that figure and is an
 * estimate. A later year has no cap: spilling at the 2026 figure would
 * overstate the Retirement Account.
 */
export function basicHealthcareSumCap(input: {
  calendarYear: number;
  age: number;
  yearTurning65: number;
}): HealthcareSumCap {
  const rows = [...PUBLISHED_BASIC_HEALTHCARE_SUMS];
  const first = rows[0];
  const yearNeeded = input.age >= 65 ? input.yearTurning65 : input.calendarYear;
  const exact = rows.find((row) => row.year === yearNeeded);
  if (exact) return { cap: exact.value, estimated: false, yearUsed: exact.year };
  if (yearNeeded < first.year) return { cap: first.value, estimated: true, yearUsed: first.year };
  return { cap: null, estimated: true, yearUsed: null };
}

export function ordinaryCeilingForYear(year: number): number {
  if (year <= CPF_WAGE.ordinaryCeiling2025.year) return CPF_WAGE.ordinaryCeiling2025.value;
  return CPF_WAGE.ordinaryCeiling.value;
}

export function contributionBand(age: number, year = PLANNING_YEAR): ContributionBand {
  const bands = scheduleForYear(CPF_CONTRIBUTION_SCHEDULES, year).bands;
  return bands.find((band) => age <= band.maxAge) ?? bands[bands.length - 1];
}

export function allocationBand(age: number, year = PLANNING_YEAR): AllocationBand {
  const bands = scheduleForYear(CPF_ALLOCATION_SCHEDULES, year).bands;
  return bands.find((band) => age <= band.maxAge) ?? bands[bands.length - 1];
}

/** 1 + 7% × years, capped at five years (35%). Not compound. */
export function cpfLifeDeferralMultiplier(yearsDeferred: number): number {
  const years = Math.min(CPF_LIFE_DEFERRAL.maxYears, Math.max(0, yearsDeferred));
  return 1 + CPF_LIFE_DEFERRAL.perYear * years;
}

export function retirementSumsForCohort(yearTurning55: number): {
  brs: number;
  frs: number;
  ers: number;
  estimated: boolean;
  yearUsed: number;
} {
  const published = [...PUBLISHED_RETIREMENT_SUMS].sort((a, b) => a.yearTurning55 - b.yearTurning55);
  const first = published[0];
  const last = published[published.length - 1];
  const exact = published.find((row) => row.yearTurning55 === yearTurning55);
  const ers = ENHANCED_RETIREMENT_SUM.value;

  if (exact) {
    return {
      brs: exact.brs,
      frs: exact.brs * 2,
      ers,
      estimated: exact.estimated,
      yearUsed: exact.yearTurning55,
    };
  }

  if (yearTurning55 < first.yearTurning55) {
    return {
      brs: first.brs,
      frs: first.brs * 2,
      ers,
      estimated: true,
      yearUsed: first.yearTurning55,
    };
  }

  const yearsAfter = yearTurning55 - last.yearTurning55;
  const raw = last.brs * (1 + RETIREMENT_SUM_GROWTH_ASSUMPTION.annual) ** yearsAfter;
  const step = RETIREMENT_SUM_GROWTH_ASSUMPTION.roundTo;
  const brs = Math.round(raw / step) * step;
  return {
    brs,
    frs: brs * 2,
    ers,
    estimated: true,
    yearUsed: yearTurning55,
  };
}

export function yearTurning55(currentAge: number, nowYear = PLANNING_YEAR): number {
  return nowYear + Math.round(55 - currentAge);
}
