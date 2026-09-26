export interface LoanInput {
  balance: number;
  /** Nominal annual interest rate, for example 0.026 for 2.6%. */
  annualInterestRate: number;
  remainingMonths: number;
  /**
   * When set, this instalment is paid instead of the level payment implied
   * by the rate. The rate is still used to split interest and principal.
   */
  monthlyInstalment?: number;
}

export interface LoanMonth {
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

/** Level monthly payment on a monthly-rest loan. */
export function levelInstalment(principal: number, annualInterestRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const monthly = annualInterestRate / 12;
  if (monthly === 0) return principal / months;
  return (principal * monthly) / (1 - (1 + monthly) ** -months);
}

export function amortisationSchedule(input: LoanInput): LoanMonth[] {
  const months = Math.max(0, Math.round(input.remainingMonths));
  const payment =
    input.monthlyInstalment && input.monthlyInstalment > 0
      ? input.monthlyInstalment
      : levelInstalment(input.balance, input.annualInterestRate, months);
  const monthly = input.annualInterestRate / 12;
  const rows: LoanMonth[] = [];
  let balance = Math.max(0, input.balance);

  for (let month = 0; month < months && balance > 0.005; month += 1) {
    const interest = balance * monthly;
    const due = balance + interest;
    const paid = Math.min(payment, due);
    const principal = paid - interest;
    balance = Math.max(0, balance - principal);
    rows.push({ payment: paid, interest, principal, balance });
  }

  return rows;
}

/** Instalment due in a given month, or 0 after the loan ends. */
export function instalmentAtMonth(schedule: LoanMonth[], month: number): number {
  return schedule[month]?.payment ?? 0;
}
