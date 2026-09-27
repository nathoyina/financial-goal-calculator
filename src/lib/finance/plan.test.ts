import { describe, expect, it } from "vitest";
import { CPF_INTEREST } from "../cpf/constants";
import { projectCpf } from "../cpf/project";
import { educationWithdrawals } from "./education";
import { amortisationSchedule } from "./loan";
import { calculatePlan, estimateNotice, type PlanInput } from "./plan";

const base: PlanInput = {
  currentAge: 40,
  retirementAge: 42,
  lifeExpectancy: 44,
  cashSavings: 0,
  monthlyIncome: 3_750,
  annualIncomeGrowth: 0,
  monthlyExpensesNow: 2_000,
  monthlyRetirementSpendingToday: 1_000,
  annualReturn: 0,
  annualInflation: 0,
  extraMonthlySaving: 0,
  includeCpf: false,
  cpf: { oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
  loan: null,
  children: [],
};

describe("retirement plan", () => {
  it("accepts early and late retirement ages", () => {
    expect(calculatePlan({ ...base, currentAge: 35, retirementAge: 40, lifeExpectancy: 90 }).valid).toBe(true);
    expect(calculatePlan({ ...base, currentAge: 70, retirementAge: 75, lifeExpectancy: 90 }).valid).toBe(true);
    const sameAge = calculatePlan({ ...base, retirementAge: 40 });
    expect(sameAge.valid).toBe(false);
    expect(sameAge.errors[0]).toMatch(/after your current age/i);
  });

  it("saves income minus employee CPF and expenses, and can fund a matching retirement spend", () => {
    const result = calculatePlan(base);
    expect(result.monthlySavingToday).toBe(3_750 - 750 - 2_000);
    expect(result.projectedCashAtRetirement).toBeCloseTo(24_000, 4);
    expect(result.nestEggNeeded).toBeCloseTo(24_000, 4);
    expect(result.canRetire).toBe(true);
    expect(result.gap).toBeCloseTo(0, 4);
    expect(result.extraMonthlySaving).toBe(0);
    expect(result.moneyRunsOutAge).toBeNull();
  });

  it("names the extra saving, spending cut, and earliest age when the plan falls short", () => {
    const result = calculatePlan({ ...base, monthlyRetirementSpendingToday: 2_000 });
    expect(result.canRetire).toBe(false);
    expect(result.extraMonthlySaving).toBeCloseTo(1_000, 0);
    expect(result.spendingCutToday).toBeCloseTo(1_000, 0);
    expect(result.earliestRetirementAge).toBe(43);
    expect(result.moneyRunsOutAge).not.toBeNull();
  });

  it("lets a cash loan reduce what can be saved, and an OA loan does not", () => {
    const cashLoan = calculatePlan({
      ...base,
      loan: {
        balance: 12_000,
        annualInterestRate: 0,
        remainingMonths: 12,
        paidFrom: "cash",
      },
    });
    expect(cashLoan.monthlySavingToday).toBe(0);
    expect(cashLoan.projectedCashAtRetirement).toBeCloseTo(12_000, 4);

    const withCpf = calculatePlan({
      ...base,
      includeCpf: true,
      cpf: { oa: 50_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
    });
    const oaLoan = calculatePlan({
      ...base,
      includeCpf: true,
      cpf: { oa: 50_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
      loan: {
        balance: 12_000,
        annualInterestRate: 0,
        remainingMonths: 12,
        paidFrom: "oa",
      },
    });
    expect(oaLoan.monthlySavingToday).toBeCloseTo(withCpf.monthlySavingToday, 4);
    expect(oaLoan.monthlySavingToday).toBeGreaterThan(cashLoan.monthlySavingToday);
    expect(oaLoan.reliesOnEstimate).toBe(true);
  });

  it("still deducts employee CPF when balances and CPF LIFE are left out", () => {
    const balances = { oa: 500_000, sa: 200_000, ra: 80_000, ma: 50_000, payoutAge: 65 };
    const citizen = {
      ...base,
      currentAge: 35,
      retirementAge: 65,
      lifeExpectancy: 90,
      monthlyIncome: 6_000,
      monthlyExpensesNow: 2_000,
      monthlyRetirementSpendingToday: 2_000,
      includeCpf: false,
      cpf: balances,
    };
    const leftOut = calculatePlan(citizen);
    const sameWithoutBalances = calculatePlan({
      ...citizen,
      cpf: { oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
    });
    const included = calculatePlan({ ...citizen, includeCpf: true });

    expect(leftOut.monthlySavingToday).toBe(6_000 - 1_200 - 2_000);
    expect(leftOut.cpfLifeMonthly).toBe(0);
    expect(leftOut.projectedCashAtRetirement).toBeCloseTo(sameWithoutBalances.projectedCashAtRetirement, 4);
    expect(leftOut.nestEggNeeded).toBeCloseTo(sameWithoutBalances.nestEggNeeded, 4);
    expect(included.cpfLifeMonthly).toBeGreaterThan(0);
    expect(included.projectedCashAtRetirement).not.toBeCloseTo(leftOut.projectedCashAtRetirement, 0);
  });

  it("takes education costs out of cash", () => {
    const result = calculatePlan({
      ...base,
      monthlyIncome: 0,
      monthlyExpensesNow: 0,
      monthlyRetirementSpendingToday: 0,
      cashSavings: 8_000,
      retirementAge: 42,
      children: [{ currentAge: 18, startAge: 19, years: 1, yearlyCostToday: 5_000 }],
    });
    expect(result.projectedCashAtRetirement).toBeCloseTo(3_000, 4);
    expect(result.canRetire).toBe(true);
  });

  it("counts an Ordinary Account sweep once, in projected cash", () => {
    const result = calculatePlan({
      currentAge: 54,
      retirementAge: 65,
      lifeExpectancy: 66,
      cashSavings: 0,
      monthlyIncome: 0,
      annualIncomeGrowth: 0,
      monthlyExpensesNow: 0,
      monthlyRetirementSpendingToday: 10_000,
      annualReturn: 0,
      annualInflation: 0,
      extraMonthlySaving: 0,
      includeCpf: true,
      cpf: { oa: 400_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
      loan: null,
      children: [],
    });
    expect(result.valid).toBe(true);
    expect(result.projectedCashAtRetirement).toBeGreaterThan(0);
    expect(result.nestEggNeeded).toBeGreaterThan(20_000);
    expect(result.gap).toBeCloseTo(result.projectedCashAtRetirement - result.nestEggNeeded, 4);
  });

  it("keeps CPF LIFE that starts before a late retirement", () => {
    const result = calculatePlan({
      currentAge: 70,
      retirementAge: 75,
      lifeExpectancy: 77,
      cashSavings: 0,
      monthlyIncome: 0,
      annualIncomeGrowth: 0,
      monthlyExpensesNow: 0,
      monthlyRetirementSpendingToday: 2_000,
      annualReturn: 0,
      annualInflation: 0,
      extraMonthlySaving: 0,
      includeCpf: true,
      cpf: { oa: 0, sa: 0, ra: 170_200, ma: 0, payoutAge: 65 },
      loan: null,
      children: [],
    });
    expect(result.valid).toBe(true);
    expect(result.cpfLifeMonthly).toBeCloseTo(950, 6);
    expect(result.projectedCashAtRetirement).toBeCloseTo(950 * 12 * 5, 0);
    expect(result.canRetire).toBe(true);
  });

  it("labels retirement sums after 2027 as estimates", () => {
    const young = calculatePlan({
      ...base,
      currentAge: 35,
      retirementAge: 65,
      lifeExpectancy: 90,
      includeCpf: true,
      cpf: { oa: 10_000, sa: 5_000, ra: 0, ma: 0, payoutAge: 65 },
    });
    expect(young.cohortYear).toBeGreaterThan(2027);
    expect(young.retirementSumEstimated).toBe(true);
    expect(young.estimates.some((note) => note.id === "retirement-sum")).toBe(true);
    expect(young.estimates.find((note) => note.id === "retirement-sum")?.explanation).toMatch(/Assumption/);
    expect(young.estimates.some((note) => note.id === "cpf-life-payout")).toBe(true);
    expect(young.estimates.find((note) => note.id === "cpf-life-payout")?.explanation).toMatch(/2026 cohort ranges/);
    expect(young.estimates.some((note) => note.id === "escalating-plan-start")).toBe(true);
    expect(young.estimates.some((note) => note.id === "housing-accrued-interest")).toBe(true);
    expect(estimateNotice(young)).toMatch(/depends on an estimate/);
    expect(estimateNotice(young)).toMatch(/retirement sum after 2027 is an assumption/);
    expect(estimateNotice(young)).toMatch(/2026 CPF LIFE payout ranges/);
    expect(estimateNotice(young)).toMatch(/Basic Healthcare Sum after 2026/);
    expect(estimateNotice(young)).not.toMatch(/Escalating/);
    expect(estimateNotice(young)).not.toMatch(/accrued-interest/);

    const published = calculatePlan({
      ...base,
      currentAge: 55,
      retirementAge: 65,
      lifeExpectancy: 90,
      includeCpf: true,
      cpf: { oa: 10_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
    });
    expect(published.cohortYear).toBe(2026);
    expect(published.retirementSumEstimated).toBe(false);
    expect(estimateNotice(published)).not.toMatch(/after 2027/);
    expect(estimateNotice(calculatePlan(base))).toBeNull();

    const newsCohort = calculatePlan({
      ...base,
      currentAge: 60,
      retirementAge: 70,
      lifeExpectancy: 90,
      includeCpf: true,
      cpf: { oa: 10_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
    });
    expect(newsCohort.cohortYear).toBe(2021);
    expect(newsCohort.retirementSumEstimated).toBe(true);
    expect(newsCohort.fullRetirementSum).toBe(186_000);
    expect(estimateNotice(newsCohort)).toMatch(/news coverage/);

    const earlyCohort = calculatePlan({
      ...base,
      currentAge: 70,
      retirementAge: 75,
      lifeExpectancy: 90,
      includeCpf: true,
      cpf: { oa: 10_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
    });
    expect(earlyCohort.cohortYear).toBe(2011);
    expect(earlyCohort.retirementSumEstimated).toBe(true);
    expect(earlyCohort.fullRetirementSum).toBe(166_000);
    expect(estimateNotice(earlyCohort)).toMatch(/2017 figures/);
  });

  it("drops retirement cash by spending minus CPF LIFE plus loan and school costs", () => {
    const spending = 2_000;
    const loan = {
      balance: 2_400,
      annualInterestRate: 0,
      remainingMonths: 30,
      paidFrom: "cash" as const,
    };
    const child = { currentAge: 20, startAge: 22, years: 1, yearlyCostToday: 3_000 };
    const input: PlanInput = {
      currentAge: 66,
      retirementAge: 68,
      lifeExpectancy: 71,
      cashSavings: 500_000,
      monthlyIncome: 0,
      annualIncomeGrowth: 0,
      monthlyExpensesNow: 0,
      monthlyRetirementSpendingToday: spending,
      annualReturn: 0,
      annualInflation: 0,
      extraMonthlySaving: 0,
      includeCpf: true,
      cpf: { oa: 0, sa: 0, ra: 170_200, ma: 10_000, payoutAge: 65 },
      loan,
      children: [child],
    };
    const result = calculatePlan(input);
    const retirementMonth = 24;
    const horizon = 60;
    const schedule = amortisationSchedule(loan);
    const school = educationWithdrawals({ children: [child], annualInflation: 0, horizonMonths: horizon });
    const schoolAt = (month: number) => school.find((item) => item.month === month)?.amount ?? 0;
    expect(result.cpfLifeMonthly).toBeCloseTo(950, 6);

    for (let month = retirementMonth; month < horizon; month += 1) {
      const need = spending - result.cpfLifeMonthly + (schedule[month]?.payment ?? 0) + schoolAt(month);
      const delta = result.series[month + 1].balance - result.series[month].balance;
      expect(delta).toBeCloseTo(-need, 4);
    }

    const withoutCpf = calculatePlan({
      ...input,
      includeCpf: false,
      monthlyIncome: 4_000,
      extraMonthlySaving: 0,
      loan: null,
      children: [],
      cpf: { oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
    });
    for (let month = retirementMonth; month < withoutCpf.series.length - 1; month += 1) {
      const delta = withoutCpf.series[month + 1].balance - withoutCpf.series[month].balance;
      expect(delta).toBeLessThan(0);
    }
  });

  it("adds nothing from salary, employee CPF, or extra saving after retirement", () => {
    const shared: PlanInput = {
      currentAge: 40,
      retirementAge: 42,
      lifeExpectancy: 45,
      cashSavings: 80_000,
      monthlyIncome: 8_000,
      annualIncomeGrowth: 0.03,
      monthlyExpensesNow: 1_000,
      monthlyRetirementSpendingToday: 1_000,
      annualReturn: 0,
      annualInflation: 0,
      extraMonthlySaving: 500,
      includeCpf: false,
      cpf: { oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
      loan: null,
      children: [],
    };
    const drops = (input: PlanInput) => {
      const result = calculatePlan(input);
      const retirementMonth = 24;
      const deltas: number[] = [];
      for (let month = retirementMonth; month < result.series.length - 1; month += 1) {
        deltas.push(result.series[month + 1].balance - result.series[month].balance);
      }
      return deltas;
    };
    const paid = drops(shared);
    const unpaid = drops({ ...shared, monthlyIncome: 0, extraMonthlySaving: 0, annualIncomeGrowth: 0 });
    expect(paid.length).toBeGreaterThan(10);
    expect(paid).toEqual(unpaid);
    expect(paid.every((delta) => delta === -1_000)).toBe(true);
  });

  it("changes the year after 65 by about S$49,781 when the default plan earns nothing", () => {
    const result = calculatePlan({
      currentAge: 35,
      retirementAge: 65,
      lifeExpectancy: 90,
      cashSavings: 40_000,
      monthlyIncome: 7_000,
      annualIncomeGrowth: 0.02,
      monthlyExpensesNow: 4_000,
      monthlyRetirementSpendingToday: 3_500,
      annualReturn: 0,
      annualInflation: 0.025,
      extraMonthlySaving: 0,
      includeCpf: true,
      cpf: { oa: 40_000, sa: 25_000, ra: 0, ma: 15_000, payoutAge: 65 },
      loan: null,
      children: [],
    });
    const at = (age: number) => result.series.find((point) => Math.abs(point.age - age) < 1e-6);
    const from66 = at(66);
    const to67 = at(67);
    expect(from66).toBeTruthy();
    expect(to67).toBeTruthy();
    expect(Math.abs((to67?.balance ?? 0) - (from66?.balance ?? 0) + 49_781)).toBeLessThanOrEqual(1);
  });

  it("keeps MediSave out of chart cash and leaves the Retirement Account at zero after payouts", () => {
    const shared: PlanInput = {
      currentAge: 40,
      retirementAge: 42,
      lifeExpectancy: 44,
      cashSavings: 5_000,
      monthlyIncome: 0,
      annualIncomeGrowth: 0,
      monthlyExpensesNow: 0,
      monthlyRetirementSpendingToday: 100,
      annualReturn: 0,
      annualInflation: 0,
      extraMonthlySaving: 0,
      includeCpf: true,
      cpf: { oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
      loan: null,
      children: [],
    };
    const without = calculatePlan(shared);
    const withMedisave = calculatePlan({ ...shared, cpf: { ...shared.cpf, ma: 40_000 } });
    expect(withMedisave.series.map((point) => point.balance)).toEqual(without.series.map((point) => point.balance));
    expect(withMedisave.projectedCashAtRetirement).toBeCloseTo(without.projectedCashAtRetirement, 4);

    const retired = projectCpf({
      currentAge: 64,
      months: 18,
      initial: { oa: 50_000, sa: 0, ra: 180_000, ma: 40_000 },
      wageAtMonth: () => 0,
      payoutAge: 65,
      withdrawOaAtMonth: 12,
    });
    const start = retired.payoutStartMonth ?? 0;
    expect(retired.balances.slice(start).every((balances) => balances.ra === 0)).toBe(true);
    expect(retired.balances.every((balances) => balances.ma >= 40_000)).toBe(true);
  });

  it("counts the Ordinary Account sweep, including this year's interest, once", () => {
    const result = calculatePlan({
      currentAge: 64,
      retirementAge: 65,
      lifeExpectancy: 67,
      cashSavings: 0,
      monthlyIncome: 0,
      annualIncomeGrowth: 0,
      monthlyExpensesNow: 0,
      monthlyRetirementSpendingToday: 0,
      annualReturn: 0,
      annualInflation: 0,
      extraMonthlySaving: 0,
      includeCpf: true,
      cpf: { oa: 100_000, sa: 0, ra: 200_000, ma: 0, payoutAge: 70 },
      loan: null,
      children: [],
    });
    const marked = result.series.filter((point) => (point.oaSweep ?? 0) > 0);
    expect(marked).toHaveLength(1);
    expect(marked[0].age).toBeCloseTo(65, 6);
    const monthly = CPF_INTEREST.ordinaryAccount.value / 12;
    let accrued = 0;
    let oa = 100_000;
    for (let month = 0; month < 12; month += 1) {
      accrued += oa * monthly;
      if ((8 + month) % 12 === 11) {
        oa += accrued;
        accrued = 0;
      }
    }
    expect(marked[0].oaSweep).toBeCloseTo(oa + accrued, 4);

    const sweepIndex = result.series.findIndex((point) => (point.oaSweep ?? 0) > 0);
    const afterSweep = result.series[sweepIndex + 1];
    expect(afterSweep.balance).toBeCloseTo(marked[0].oaSweep ?? 0, 4);
    const later = result.series[result.series.length - 1];

    const cpf = projectCpf({
      currentAge: 64,
      months: 36,
      initial: { oa: 100_000, sa: 0, ra: 200_000, ma: 0 },
      wageAtMonth: () => 0,
      payoutAge: 70,
      withdrawOaAtMonth: 12,
    });
    expect(cpf.balances.slice(12).every((balances) => balances.oa === 0)).toBe(true);
    const credits = cpf.postSweepOaCredits.reduce((sum, amount) => sum + amount, 0);
    expect(credits).toBeCloseTo(0, 4);
    expect(later.balance).toBeCloseTo(marked[0].oaSweep ?? 0, 4);
  });

  it("sweeps leftover Ordinary Account savings the month after an OA loan ends", () => {
    const result = calculatePlan({
      currentAge: 60,
      retirementAge: 62,
      lifeExpectancy: 66,
      cashSavings: 0,
      monthlyIncome: 0,
      annualIncomeGrowth: 0,
      monthlyExpensesNow: 0,
      monthlyRetirementSpendingToday: 0,
      annualReturn: 0,
      annualInflation: 0,
      extraMonthlySaving: 0,
      includeCpf: true,
      cpf: { oa: 400_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
      loan: {
        balance: 12_000,
        annualInterestRate: 0,
        remainingMonths: 30,
        paidFrom: "oa",
      },
      children: [],
    });
    expect(result.projectedCashAtRetirement).toBeCloseTo(0, 4);
    const marked = result.series.filter((point) => (point.oaSweep ?? 0) > 0);
    expect(marked).toHaveLength(1);
    expect(marked[0].age).toBeCloseTo(62.5, 5);
    expect(marked[0].oaSweep ?? 0).toBeGreaterThan(38_000);
    const sweepIndex = result.series.findIndex((point) => (point.oaSweep ?? 0) > 0);
    expect(result.series[sweepIndex].balance).toBeCloseTo(0, 4);
    expect(result.series[sweepIndex + 1].balance).toBeCloseTo(marked[0].oaSweep ?? 0, 4);
  });
});
