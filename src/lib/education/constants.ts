/**
 * University cost figures for the education step.
 *
 * Checked 26 September 2026 against docs/education-reference-2026.md.
 * Every number below is from that note. Do not add a fee, a rate, or a
 * year that the note does not give. The SGD totals marked "about" are the
 * note's own rounded figures, not a fresh conversion.
 */

export const EDUCATION_CONSTANTS_AS_OF = "2026-09-26";

/** SingStat/MAS end-July 2026, SGD per 1 unit of foreign currency. */
export const EDUCATION_EXCHANGE_RATES = {
  asOf: "end-July 2026",
  year: 2026,
  sgdPerGbp: 1.7269,
  sgdPerAud: 0.9021,
  sgdPerUsd: 1.2838,
  source: "data.gov.sg dataset d_cdd73fd4341b345fa4307e44d6f82175",
} as const;

export const NUS_TUITION_SOURCE =
  "https://www.nus.edu.sg/registrar/docs/default-source/administrative-policies-procedures/ugtuitioncurrent.pdf";

export const NTU_TUITION_SOURCE =
  "https://www.ntu.edu.sg/admissions/undergraduate/financial-matters/tuition-fees/accepted-programme-offer-in-2026";

export const SMU_TUITION_SOURCE = "https://admissions.smu.edu.sg/financial-matters/tuition-fees-grant";

export const NUS_LIVING_COSTS_SOURCE = "https://www.nus.edu.sg/oam/financial-aid/living-costs";

export const UCAS_TUITION_SOURCE =
  "https://www.ucas.com/international/international-students/financial-information-for-international-students/what-finance-options-are-available-if-i-want-to-study-in-the-uk";

export const UK_VISA_MONEY_SOURCE = "https://www.gov.uk/student-visa/money";

export const AUSTRALIA_VISA_LIVING_SOURCE = "https://www.legislation.gov.au/F2019L01366/latest/details";

export const RMIT_TUITION_SOURCE =
  "https://www.rmit.edu.au/study-with-us/international-students/study/cost-of-studying-in-australia";

export const SWINBURNE_TUITION_SOURCE =
  "https://www.swinburne.edu.au/courses/fees/fees-for-international-students/";

export const COLLEGE_BOARD_SOURCE = "https://research.collegeboard.org/trends/college-pricing/highlights";

/**
 * Caveat for the estimate tag on a preset.
 * Visa living-cost figures are minimums. Flights and insurance are excluded.
 * Checked 26 September 2026.
 */
export const EDUCATION_ESTIMATE_CAVEAT =
  "Visa living-cost figures are minimums. Flights and insurance aren't included.";

/**
 * Australia's A$45,000 tuition is an assumption. There is no official average.
 * Year 2026.
 */
export const AUSTRALIA_TUITION_ASSUMPTION_NOTE = "Tuition is an assumption.";

/**
 * Singapore citizen, MOE-subsidised local university.
 * The preset is S$8,300 tuition plus S$6,000 living costs, for 4 years,
 * with the child living at home. Hostel fees are not in the preset.
 */
export const LOCAL_UNIVERSITY = {
  tuitionMostNusNtuSgd: 8_300,
  tuitionYear: 2026,
  tuitionSources: [NUS_TUITION_SOURCE, NTU_TUITION_SOURCE],
  /** Business programmes at NUS and NTU. Reference only, not the preset. */
  businessTuitionMinSgd: 9_500,
  businessTuitionMaxSgd: 9_700,
  businessTuitionYear: 2026,
  /** Most SMU degrees. Reference only, not the preset. */
  smuTuitionSgd: 11_550,
  smuTuitionYear: 2026,
  smuTuitionSource: SMU_TUITION_SOURCE,
  /** Living costs excluding accommodation. Year of the 26 September 2026 check. */
  livingExcludingAccommodationSgd: 6_000,
  livingYear: 2026,
  livingSource: NUS_LIVING_COSTS_SOURCE,
  /** On-campus hostel, optional, not in the preset. */
  hostelMinSgd: 4_000,
  hostelMaxSgd: 10_290,
  hostelYear: 2026,
  hostelSource: NUS_LIVING_COSTS_SOURCE,
  /** S$8,300 + S$6,000. */
  yearlyCostSgd: 14_300,
  years: 4,
  year: 2026,
} as const;

/**
 * UK international undergraduate. Living cost is the visa minimum outside London
 * (GBP 1,171 x 9 months). London is GBP 1,529 x 9 and is not the preset.
 * The SGD total is the reference's "about S$56,200".
 */
export const UK_UNIVERSITY = {
  tuitionGbp: 22_000,
  tuitionMinGbp: 11_400,
  tuitionMaxGbp: 38_000,
  tuitionYear: 2026,
  tuitionSource: UCAS_TUITION_SOURCE,
  visaMonthlyOutsideLondonGbp: 1_171,
  visaMonths: 9,
  livingOutsideLondonGbp: 10_539,
  visaMonthlyLondonGbp: 1_529,
  livingYear: 2026,
  livingSource: UK_VISA_MONEY_SOURCE,
  totalGbp: 32_539,
  yearlyCostSgd: 56_200,
  years: 3,
  year: 2026,
  tuitionIsAssumption: false,
} as const;

/**
 * Australia international undergraduate. Tuition of A$45,000 is an assumption.
 * Living cost is the student visa requirement, LIN 19/198, A$29,710.
 * The SGD total is the reference's "about S$67,400".
 */
export const AUSTRALIA_UNIVERSITY = {
  tuitionAud: 45_000,
  tuitionIsAssumption: true,
  tuitionYear: 2026,
  /** 2026 examples only. Not used as the preset tuition. */
  rmitTuitionMinAud: 36_000,
  rmitTuitionMaxAud: 50_000,
  rmitYear: 2026,
  rmitSource: RMIT_TUITION_SOURCE,
  swinburneTuitionMinAud: 34_200,
  swinburneTuitionMaxAud: 47_320,
  swinburneYear: 2026,
  swinburneSource: SWINBURNE_TUITION_SOURCE,
  livingAud: 29_710,
  livingYear: 2026,
  livingSource: AUSTRALIA_VISA_LIVING_SOURCE,
  totalAud: 74_710,
  yearlyCostSgd: 67_400,
  years: 3,
  year: 2026,
} as const;

/**
 * US public university, out-of-state sticker price, plus room and board.
 * College Board Trends in College Pricing 2025-26.
 * The SGD total is the reference's "about S$58,800".
 */
export const US_PUBLIC_UNIVERSITY = {
  tuitionUsd: 31_880,
  roomAndBoardUsd: 13_900,
  totalUsd: 45_780,
  yearlyCostSgd: 58_800,
  years: 4,
  academicYear: "2025-26",
  year: 2026,
  source: COLLEGE_BOARD_SOURCE,
  tuitionIsAssumption: false,
} as const;

/**
 * US private nonprofit university, reference sticker price, plus room and board.
 * Same College Board 2025-26 source. The SGD total is the reference's "about S$78,200".
 */
export const US_PRIVATE_UNIVERSITY = {
  tuitionUsd: 45_000,
  roomAndBoardUsd: 15_920,
  totalUsd: 60_920,
  yearlyCostSgd: 78_200,
  years: 4,
  academicYear: "2025-26",
  year: 2026,
  source: COLLEGE_BOARD_SOURCE,
  tuitionIsAssumption: false,
} as const;

export const EDUCATION_PRESETS = {
  local: LOCAL_UNIVERSITY,
  uk: UK_UNIVERSITY,
  australia: AUSTRALIA_UNIVERSITY,
  "us-public": US_PUBLIC_UNIVERSITY,
  "us-private": US_PRIVATE_UNIVERSITY,
} as const;

export type EducationPresetId = keyof typeof EDUCATION_PRESETS;
