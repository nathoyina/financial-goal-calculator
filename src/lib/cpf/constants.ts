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

/** Floor rates for 1 July 2026 to 30 September 2026. The 4% SMRA floor is only committed through 31 December 2026. */
export const CPF_INTEREST = {
  ordinaryAccount: {
    value: 0.025,
    year: 2026,
    source:
      "https://www.cpf.gov.sg/member/infohub/news/news-releases/cpf-interest-rates-from-1-july-to-30-september-2026",
  },
  specialMedisaveRetirement: {
    value: 0.04,
    year: 2026,
    source:
      "https://www.cpf.gov.sg/member/infohub/news/news-releases/government-extends-4-per-cent-interest-rate-floor-on-special-medisave-and-retirement-account-monies-until-31-december-2026",
  },
  /** Extra 1% on the first $60,000 combined, OA capped at $20,000, for members below 55. */
  extraBelow55: {
    value: 0.01,
    firstCombined: 60_000,
    ordinaryCap: 20_000,
    year: 2026,
    source:
      "https://www.cpf.gov.sg/member/infohub/news/news-releases/cpf-interest-rates-from-1-july-to-30-september-2026",
  },
  /** From 55: extra 2% on the first $30,000 (OA capped at $20,000) and extra 1% on the next $30,000. */
  extraFrom55: {
    firstTier: 0.02,
    firstCombined: 30_000,
    secondTier: 0.01,
    secondCombined: 30_000,
    ordinaryCap: 20_000,
    year: 2026,
    source:
      "https://www.cpf.gov.sg/member/infohub/news/news-releases/cpf-interest-rates-from-1-july-to-30-september-2026",
  },
} as const;

/** Ordinary wage ceiling from 1 January 2026. Full rates below apply only above $750 a month. */
export const CPF_WAGE = {
  ordinaryCeiling: {
    value: 8_000,
    year: 2026,
    source:
      "https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFcontributionratesfrom1Jan2026.pdf",
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

/** Singapore citizens and SPRs from the third year, monthly wages above $750, from 1 January 2026. */
export const CPF_CONTRIBUTION_BANDS: ContributionBand[] = [
  { maxAge: 55, employer: 0.17, employee: 0.2 },
  { maxAge: 60, employer: 0.16, employee: 0.18 },
  { maxAge: 65, employer: 0.125, employee: 0.125 },
  { maxAge: 70, employer: 0.09, employee: 0.075 },
  { maxAge: Infinity, employer: 0.075, employee: 0.05 },
];

export const CPF_CONTRIBUTION_SOURCE =
  "https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay";

export interface AllocationBand {
  maxAge: number;
  /** Ratio of the total contribution, not of the wage. MediSave is applied first, then SA/RA, and OA gets the rest. */
  ma: number;
  specialOrRetirement: number;
  oa: number;
}

/** Allocation ratios from 1 January 2026. */
export const CPF_ALLOCATION_BANDS: AllocationBand[] = [
  { maxAge: 35, oa: 0.6217, specialOrRetirement: 0.1621, ma: 0.2162 },
  { maxAge: 45, oa: 0.5677, specialOrRetirement: 0.1891, ma: 0.2432 },
  { maxAge: 50, oa: 0.5136, specialOrRetirement: 0.2162, ma: 0.2702 },
  { maxAge: 55, oa: 0.4055, specialOrRetirement: 0.3108, ma: 0.2837 },
  { maxAge: 60, oa: 0.353, specialOrRetirement: 0.3382, ma: 0.3088 },
  { maxAge: 65, oa: 0.14, specialOrRetirement: 0.44, ma: 0.42 },
  { maxAge: 70, oa: 0.0607, specialOrRetirement: 0.303, ma: 0.6363 },
  { maxAge: Infinity, oa: 0.08, specialOrRetirement: 0.08, ma: 0.84 },
];

export const CPF_ALLOCATION_SOURCE =
  "https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFAllocationRatesfromJanuary2026.pdf";

export interface RetirementSumYear {
  /** Calendar year the member turns 55. BRS and FRS stay fixed for that cohort. */
  yearTurning55: number;
  brs: number;
}

/**
 * Published retirement sums. FRS is 2 x BRS. From 2025 the ERS is 4 x BRS
 * (it used to be 3 x BRS). Sums after 2027 are not published; callers must
 * label any later figure as an estimate.
 */
export const PUBLISHED_RETIREMENT_SUMS: RetirementSumYear[] = [
  { yearTurning55: 2025, brs: 106_500 },
  { yearTurning55: 2026, brs: 110_200 },
  { yearTurning55: 2027, brs: 114_100 },
];

export const RETIREMENT_SUM_SOURCE =
  "https://www.cpf.gov.sg/member/infohub/educational-resources/how-the-cpf-retirement-sum-affects-your-payouts";

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

/** CPF says payouts rise by up to 7% for each year they are deferred, up to age 70. */
export const CPF_LIFE_DEFERRAL = {
  perYear: 0.07,
  earliestAge: 65,
  latestAge: 70,
  source: RETIREMENT_SUM_SOURCE,
  note: "CPF describes this as up to 7% a year, so a plan that uses 7% is an estimate.",
} as const;

export const BASIC_HEALTHCARE_SUM = {
  value: 79_000,
  year: 2026,
  source:
    "https://www.cpf.gov.sg/member/infohub/news/news-releases/cpf-interest-rates-from-1-january-to-31-march-2026-and-basic-healthcare-sum-for-2026",
  note: "Applies in 2026 to members below 65, and is fixed for members who turn 65 in 2026. Later years are not published here.",
} as const;

export const PLANNING_YEAR = 2026;

export function contributionBand(age: number): ContributionBand {
  return CPF_CONTRIBUTION_BANDS.find((band) => age <= band.maxAge) ?? CPF_CONTRIBUTION_BANDS.at(-1)!;
}

export function allocationBand(age: number): AllocationBand {
  return CPF_ALLOCATION_BANDS.find((band) => age <= band.maxAge) ?? CPF_ALLOCATION_BANDS.at(-1)!;
}

export function retirementSumsForCohort(yearTurning55: number): {
  brs: number;
  frs: number;
  ers: number;
  estimated: boolean;
  yearUsed: number;
} {
  const exact = PUBLISHED_RETIREMENT_SUMS.find((row) => row.yearTurning55 === yearTurning55);
  const row = exact ?? PUBLISHED_RETIREMENT_SUMS.at(-1)!;
  return {
    brs: row.brs,
    frs: row.brs * 2,
    ers: row.brs * ERS_MULTIPLE_OF_BRS.value,
    estimated: !exact,
    yearUsed: row.yearTurning55,
  };
}

export function yearTurning55(currentAge: number, nowYear = PLANNING_YEAR): number {
  return nowYear + Math.round(55 - currentAge);
}
