export interface ChildEducation {
  currentAge: number;
  /** Child's age when the first yearly cost is paid. */
  startAge: number;
  years: number;
  /** One year of fees and living costs, in today's prices. */
  yearlyCostToday: number;
}

export interface EducationWithdrawal {
  /** Months from today. */
  month: number;
  /** Nominal dollars withdrawn that month. */
  amount: number;
  childIndex: number;
}

/**
 * Yearly education costs, inflated from today and taken at the start of
 * each study year. Costs that begin in the past are ignored.
 */
export function educationWithdrawals(params: {
  children: ChildEducation[];
  annualInflation: number;
  horizonMonths: number;
}): EducationWithdrawal[] {
  const withdrawals: EducationWithdrawal[] = [];
  params.children.forEach((child, childIndex) => {
    if (child.years <= 0 || child.yearlyCostToday <= 0) return;
    const monthsUntilStart = Math.round((child.startAge - child.currentAge) * 12);
    for (let year = 0; year < child.years; year += 1) {
      const month = monthsUntilStart + year * 12;
      if (month < 0 || month >= params.horizonMonths) continue;
      const yearsFromNow = month / 12;
      withdrawals.push({
        month,
        amount: child.yearlyCostToday * (1 + params.annualInflation) ** yearsFromNow,
        childIndex,
      });
    }
  });
  return withdrawals.sort((a, b) => a.month - b.month);
}

export function educationByMonth(withdrawals: EducationWithdrawal[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const item of withdrawals) {
    totals.set(item.month, (totals.get(item.month) ?? 0) + item.amount);
  }
  return totals;
}
