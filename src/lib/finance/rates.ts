/** Monthly effective rate that compounds to the given annual effective rate. */
export function monthlyRate(annualRate: number): number {
  return (1 + annualRate) ** (1 / 12) - 1;
}

/** Annual return left after inflation: (1 + return) / (1 + inflation) - 1. */
export function realAnnualReturn(annualReturn: number, annualInflation: number): number {
  return (1 + annualReturn) / (1 + annualInflation) - 1;
}

export function yearsToMonths(years: number): number {
  return Math.round(years * 12);
}
