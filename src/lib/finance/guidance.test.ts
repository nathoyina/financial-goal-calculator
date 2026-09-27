import { describe, expect, it } from "vitest";
import { calculatePlan, estimateNotice, type PlanInput } from "./plan";
import { DEFAULT_PLAN_FORM, enteredCpfBalances, parsePlanForm, validateStep } from "./plan-form";
import { parseDecimal } from "./parse";
import {
  cpfLifeDollarYear,
  cpfLifeInTodaysMoney,
  displayedBalance,
  inTodaysMoney,
  monthlySavingCard,
  projectedSalaryExceedsCeiling,
  savingsKeepGrowingSentence,
  spendingExceedsTakeHome,
  takeHomeExcessSentence,
  takeHomePay,
  yearsUntilRetirementLine,
} from "./guidance";
import { realAnnualReturn } from "./rates";

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

describe("money parsing", () => {
  it("accepts currency symbols, commas, and spaces, and rejects other text", () => {
    expect(parseDecimal("S$1,200")).toBe(1200);
    expect(parseDecimal("s$1,200.50")).toBe(1200.5);
    expect(parseDecimal("$1,200")).toBe(1200);
    expect(parseDecimal("1,200")).toBe(1200);
    expect(parseDecimal("1 200")).toBe(1200);
    expect(parseDecimal("  S$ 1,200 ")).toBe(1200);
    expect(parseDecimal("2.5%")).toBe(2.5);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("12abc")).toBeNull();
    expect(parseDecimal("S$")).toBeNull();

    const parsed = parsePlanForm({ ...DEFAULT_PLAN_FORM, monthlyIncome: "S$6,000", cashSavings: "1,200" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.monthlyIncome).toBe(6000);
    expect(parsed.input.cashSavings).toBe(1200);
  });
});

describe("validation reasons", () => {
  it("classifies a blank, a bad format, and an impossible age", () => {
    expect(validateStep(0, { ...DEFAULT_PLAN_FORM, currentAge: "" })?.reason).toBe("missing");
    expect(validateStep(0, { ...DEFAULT_PLAN_FORM, retirementAge: "soon" })?.reason).toBe("format");
    expect(validateStep(0, { ...DEFAULT_PLAN_FORM, currentAge: "200" })?.reason).toBe("out-of-range");
    expect(validateStep(0, { ...DEFAULT_PLAN_FORM, currentAge: "35", retirementAge: "35" })?.reason).toBe(
      "out-of-range",
    );
    expect(validateStep(1, { ...DEFAULT_PLAN_FORM, monthlyIncome: "S$6,000" })).toBeNull();
  });
});

describe("years until retirement", () => {
  it("states the gap in years and flags an age that is not in the future", () => {
    expect(yearsUntilRetirementLine(35, 55)).toBe("That's 20 years from now.");
    expect(yearsUntilRetirementLine(35, 36)).toBe("That's 1 year from now.");
    expect(yearsUntilRetirementLine(35, 35)).toBe("That's the same as your age today.");
    expect(yearsUntilRetirementLine(35, 30)).toBe("That's 5 years before your age today.");
  });
});

describe("take-home pay", () => {
  it("uses CPF age bands, the wage ceiling, and the below-S$750 rule", () => {
    expect(takeHomePay({ currentAge: 35, monthlyIncome: 6_000 })).toBe(4_800);
    expect(
      takeHomeExcessSentence({
        currentAge: 35,
        monthlyIncome: 6_000,
        monthlyExpensesNow: 5_000,
      }),
    ).toBe("That's about S$200 more than your take-home pay of S$4,800.");
    expect(spendingExceedsTakeHome({ currentAge: 35, monthlyIncome: 6_000, monthlyExpensesNow: 4_800 })).toBe(false);

    expect(takeHomePay({ currentAge: 35, monthlyIncome: 9_000 })).toBe(7_400);
    expect(takeHomePay({ currentAge: 35, monthlyIncome: 700 })).toBe(700);
    expect(takeHomePay({ currentAge: 57, monthlyIncome: 8_000 })).toBe(6_560);
    expect(takeHomePay({ currentAge: 35, monthlyIncome: 6_000 })).toBe(4_800);
    expect(spendingExceedsTakeHome({ currentAge: 35, monthlyIncome: 6_000, monthlyExpensesNow: 5_000 })).toBe(true);
  });
});

describe("saved each month card", () => {
  it("calls a surplus saved, and a shortfall short, without a minus sign", () => {
    const savedPlan = calculatePlan(base);
    const saved = monthlySavingCard(savedPlan.monthlySavingToday);
    expect(savedPlan.monthlySavingToday).toBeGreaterThan(0);
    expect(saved.label).toBe("Saved each month now");
    expect(saved.short).toBe(false);
    expect(saved.displayAmount).toBe(savedPlan.monthlySavingToday);
    expect(saved.explanation).toMatch(/other income you'd save/);

    const shortPlan = calculatePlan({ ...base, monthlyExpensesNow: 5_000 });
    const short = monthlySavingCard(shortPlan.monthlySavingToday);
    expect(shortPlan.monthlySavingToday).toBeLessThan(0);
    expect(short.label).toBe("Short each month now");
    expect(short.short).toBe(true);
    expect(short.displayAmount).toBe(Math.abs(shortPlan.monthlySavingToday));
    expect(short.displayAmount).toBeGreaterThan(0);
    expect(String(short.displayAmount)).not.toMatch(/^-/);
    expect(short.explanation).toMatch(/more than take-home pay/);

    const even = monthlySavingCard(0);
    expect(even.label).toBe("Saved each month now");
    expect(even.displayAmount).toBe(0);
    expect(even.short).toBe(false);
  });
});

describe("spend less now", () => {
  it("searches today's spending and leaves the retirement-spending suggestion in place", () => {
    const shortfall = calculatePlan({ ...base, monthlyExpensesNow: 2_500 });
    expect(shortfall.canRetire).toBe(false);
    expect(shortfall.spendingCutNow).toBeCloseTo(500, 0);
    expect(shortfall.spendingCutToday).not.toBeNull();

    const fixed = calculatePlan({
      ...base,
      monthlyExpensesNow: 2_500 - (shortfall.spendingCutNow ?? 0),
    });
    expect(fixed.canRetire).toBe(true);
  });

  it("hides the suggestion when cutting today's spending cannot make the plan last", () => {
    const impossible = calculatePlan({
      ...base,
      monthlyIncome: 1_000,
      monthlyExpensesNow: 1_000,
      monthlyRetirementSpendingToday: 100_000,
      retirementAge: 41,
      lifeExpectancy: 50,
    });
    expect(impossible.canRetire).toBe(false);
    expect(impossible.spendingCutNow).toBeNull();
  });
});

describe("CPF LIFE in today's money", () => {
  it("names the payout year and deflates the flat amount by the user's inflation", () => {
    expect(cpfLifeDollarYear(35, 65)).toBe(2056);
    const today = cpfLifeInTodaysMoney({
      currentAge: 35,
      payoutAge: 65,
      annualInflation: 0.025,
      monthlyPayout: 3_462,
    });
    expect(today).toBeCloseTo(3_462 / 1.025 ** 30, 6);

    expect(
      cpfLifeInTodaysMoney({
        currentAge: 35,
        payoutAge: 65,
        annualInflation: 0,
        monthlyPayout: 3_462,
      }),
    ).toBe(3_462);

    expect(cpfLifeDollarYear(70, 65)).toBe(2026);
    expect(
      cpfLifeInTodaysMoney({
        currentAge: 70,
        payoutAge: 65,
        annualInflation: 0.025,
        monthlyPayout: 950,
      }),
    ).toBe(950);
  });
});

describe("optional yes or no", () => {
  const child = {
    id: "child-1",
    currentAge: "6",
    startAge: "19",
    years: "3",
    yearlyCostToday: "12000",
    educationChoice: "custom" as const,
    overseasPreset: null,
    startedFrom: "custom" as const,
    startedOverseas: null,
    presetEdited: false,
  };

  it("checks loan and education fields only after Yes, and always checks CPF balances", () => {
    expect(validateStep(2, DEFAULT_PLAN_FORM)).toBeNull();
    expect(validateStep(2, { ...DEFAULT_PLAN_FORM, loanAnswer: "no", loanBalance: "" })).toBeNull();
    expect(validateStep(2, { ...DEFAULT_PLAN_FORM, loanAnswer: "yes", loanBalance: "" })?.field).toBe("loanBalance");

    expect(validateStep(3, DEFAULT_PLAN_FORM)).toBeNull();
    expect(validateStep(3, { ...DEFAULT_PLAN_FORM, oa: "", sa: "", ra: "", ma: "" })).toBeNull();
    expect(validateStep(3, { ...DEFAULT_PLAN_FORM, oa: "0", sa: "0", ma: "0" })).toBeNull();
    expect(validateStep(3, { ...DEFAULT_PLAN_FORM, ma: "none" })?.reason).toBe("format");
    expect(validateStep(3, { ...DEFAULT_PLAN_FORM, currentAge: "60", ra: "abc" })?.field).toBe("ra");
    expect(validateStep(3, { ...DEFAULT_PLAN_FORM, currentAge: "60", sa: "abc", ra: "" })).toBeNull();

    expect(validateStep(4, DEFAULT_PLAN_FORM)).toBeNull();
    expect(validateStep(4, { ...DEFAULT_PLAN_FORM, childrenAnswer: "yes" })?.message).toBe("Add a child, or choose No.");
    expect(validateStep(4, { ...DEFAULT_PLAN_FORM, childrenAnswer: "no", children: [child] })).toBeNull();
    expect(validateStep(4, { ...DEFAULT_PLAN_FORM, childrenAnswer: "yes", children: [child] })).toBeNull();
  });

  it("treats No as no loan and no children, and still includes CPF when balances are blank", () => {
    const noLoan = parsePlanForm({
      ...DEFAULT_PLAN_FORM,
      loanAnswer: "no",
      hasLoan: true,
      loanBalance: "300000",
    });
    expect(noLoan.ok && noLoan.input.loan).toBeNull();

    const blankCpf = parsePlanForm(DEFAULT_PLAN_FORM);
    expect(blankCpf.ok && blankCpf.input.includeCpf).toBe(true);
    expect(blankCpf.ok && blankCpf.input.cpf).toEqual({ oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 });

    const noChildren = parsePlanForm({ ...DEFAULT_PLAN_FORM, childrenAnswer: "no", children: [child] });
    expect(noChildren.ok && noChildren.input.children).toEqual([]);

    const yesLoan = parsePlanForm({
      ...DEFAULT_PLAN_FORM,
      loanAnswer: "yes",
      hasLoan: true,
      loanBalance: "300000",
      loanRate: "2.6",
      loanYears: "20",
    });
    expect(yesLoan.ok && yesLoan.input.loan?.balance).toBe(300_000);

    const unanswered = parsePlanForm(DEFAULT_PLAN_FORM);
    expect(unanswered.ok && unanswered.input.includeCpf).toBe(true);
    expect(unanswered.ok && unanswered.input.loan).toBeNull();
    expect(unanswered.ok && unanswered.input.children).toEqual([]);
  });

  it("ignores figures while No is selected and uses them again when Yes is chosen", () => {
    const loanFields = {
      ...DEFAULT_PLAN_FORM,
      hasLoan: true,
      loanBalance: "12000",
      loanRate: "0",
      loanYears: "1",
      loanPaidFrom: "cash" as const,
    };
    const loanYes = parsePlanForm({ ...loanFields, loanAnswer: "yes" });
    const loanNo = parsePlanForm({ ...loanFields, loanAnswer: "no" });
    const loanAgain = parsePlanForm({ ...loanFields, loanAnswer: "yes" });
    expect(loanYes.ok && loanNo.ok && loanAgain.ok).toBe(true);
    if (loanYes.ok && loanNo.ok && loanAgain.ok) {
      expect(loanYes.input.loan?.balance).toBe(12_000);
      expect(loanNo.input.loan).toBeNull();
      expect(loanAgain.input.loan?.balance).toBe(12_000);
      expect(loanNo.result.monthlySavingToday).toBeGreaterThan(loanYes.result.monthlySavingToday);
      expect(loanAgain.result.monthlySavingToday).toBe(loanYes.result.monthlySavingToday);
      expect(loanAgain.result.gap).toBeCloseTo(loanYes.result.gap, 4);
    }

    const blank = parsePlanForm(DEFAULT_PLAN_FORM);
    const withOa = parsePlanForm({ ...DEFAULT_PLAN_FORM, oa: "400000" });
    const backToBlank = parsePlanForm({ ...DEFAULT_PLAN_FORM, oa: "" });
    const leftOut = blank.ok
      ? calculatePlan({ ...blank.input, includeCpf: false, cpf: { oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 } })
      : null;
    expect(blank.ok && withOa.ok && backToBlank.ok && leftOut).toBeTruthy();
    if (blank.ok && withOa.ok && backToBlank.ok && leftOut) {
      expect(withOa.input.includeCpf).toBe(true);
      expect(withOa.input.cpf.oa).toBe(400_000);
      expect(blank.input.includeCpf).toBe(true);
      expect(blank.input.cpf).toEqual({ oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 });
      expect(blank.result.cpfLifeMonthly).toBeGreaterThan(0);
      expect(blank.result.projectedCashAtRetirement).not.toBeCloseTo(leftOut.projectedCashAtRetirement, 0);
      expect(blank.result.projectedCashAtRetirement).not.toBeCloseTo(withOa.result.projectedCashAtRetirement, 0);
      expect(backToBlank.input.includeCpf).toBe(true);
      expect(backToBlank.result.gap).toBeCloseTo(blank.result.gap, 4);
      expect(backToBlank.result.cpfLifeMonthly).toBeCloseTo(blank.result.cpfLifeMonthly, 4);
    }

    const withChild = {
      ...DEFAULT_PLAN_FORM,
      children: [child],
    };
    const childYes = parsePlanForm({ ...withChild, childrenAnswer: "yes" });
    const childNo = parsePlanForm({ ...withChild, childrenAnswer: "no" });
    const childAgain = parsePlanForm({ ...withChild, childrenAnswer: "yes" });
    expect(childYes.ok && childNo.ok && childAgain.ok).toBe(true);
    if (childYes.ok && childNo.ok && childAgain.ok) {
      expect(childYes.input.children).toHaveLength(1);
      expect(childNo.input.children).toEqual([]);
      expect(childAgain.input.children).toEqual(childYes.input.children);
      expect(childNo.result.projectedCashAtRetirement).toBeGreaterThan(childYes.result.projectedCashAtRetirement);
      expect(childAgain.result.gap).toBeCloseTo(childYes.result.gap, 4);
    }
  });

  it("includes CPF on the default plan when the balance fields are left empty", () => {
    const parsed = parsePlanForm(DEFAULT_PLAN_FORM);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(DEFAULT_PLAN_FORM.oa).toBe("");
    expect(DEFAULT_PLAN_FORM.sa).toBe("");
    expect(DEFAULT_PLAN_FORM.ra).toBe("");
    expect(DEFAULT_PLAN_FORM.ma).toBe("");
    expect(parsed.input.includeCpf).toBe(true);
    expect(parsed.input.cpf).toEqual({ oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 });

    const previousStarterBalances = calculatePlan({
      ...parsed.input,
      includeCpf: true,
      cpf: { oa: 40_000, sa: 25_000, ra: 0, ma: 15_000, payoutAge: 65 },
    });
    const leftOut = calculatePlan({
      ...parsed.input,
      includeCpf: false,
      cpf: { oa: 0, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
    });
    expect(parsed.result.cpfLifeMonthly).toBeGreaterThan(0);
    expect(parsed.result.monthlySavingToday).toBeCloseTo(1_600, 4);
    expect(parsed.result.gap).not.toBeCloseTo(previousStarterBalances.gap, 0);
    expect(parsed.result.projectedCashAtRetirement).not.toBeCloseTo(leftOut.projectedCashAtRetirement, 0);
    expect(parsed.result.cpfLifeMonthly).not.toBeCloseTo(previousStarterBalances.cpfLifeMonthly, 0);

    const younger = parsePlanForm({ ...DEFAULT_PLAN_FORM, sa: "1000", ra: "99999" });
    expect(younger.ok && younger.input.cpf.sa).toBe(1_000);
    expect(younger.ok && younger.input.cpf.ra).toBe(0);
    expect(enteredCpfBalances({ ...DEFAULT_PLAN_FORM, sa: "1000" })).toBe("yes");
    expect(enteredCpfBalances(DEFAULT_PLAN_FORM)).toBe("no");

    const older = parsePlanForm({
      ...DEFAULT_PLAN_FORM,
      currentAge: "60",
      oa: "10000",
      sa: "99999",
      ra: "5000",
    });
    expect(older.ok && older.input.includeCpf).toBe(true);
    expect(older.ok && older.input.cpf).toEqual({ oa: 10_000, sa: 0, ra: 5_000, ma: 0, payoutAge: 65 });
    expect(enteredCpfBalances({ ...DEFAULT_PLAN_FORM, currentAge: "60", sa: "99999", ra: "" })).toBe("no");
    expect(enteredCpfBalances({ ...DEFAULT_PLAN_FORM, currentAge: "60", ra: "5000" })).toBe("yes");
  });
});

describe("today's money on the chart", () => {
  it("equals the future balance divided by inflation since today", () => {
    const future = 2_425_682;
    const years = 30;
    const inflation = 0.025;
    expect(inTodaysMoney(future, years, inflation)).toBeCloseTo(future / (1 + inflation) ** years, 6);
    expect(inTodaysMoney(future, 0, inflation)).toBe(future);
    expect(inTodaysMoney(future, years, 0)).toBe(future);
    expect(
      displayedBalance({
        balance: future,
        age: 65,
        currentAge: 35,
        annualInflation: inflation,
        mode: "today",
      }),
    ).toBeCloseTo(future / (1 + inflation) ** years, 6);
    expect(
      displayedBalance({
        balance: future,
        age: 65,
        currentAge: 35,
        annualInflation: inflation,
        mode: "future",
      }),
    ).toBe(future);
  });
});

describe("savings that keep growing", () => {
  const defaults: PlanInput = {
    currentAge: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    cashSavings: 40_000,
    monthlyIncome: 7_000,
    annualIncomeGrowth: 0.02,
    monthlyExpensesNow: 4_000,
    monthlyRetirementSpendingToday: 3_500,
    annualReturn: 0.05,
    annualInflation: 0.025,
    extraMonthlySaving: 0,
    includeCpf: true,
    cpf: { oa: 40_000, sa: 25_000, ra: 0, ma: 15_000, payoutAge: 65 },
    loan: null,
    children: [],
  };

  const sentenceFor = (input: PlanInput) => {
    const result = calculatePlan(input);
    return {
      result,
      sentence: savingsKeepGrowingSentence({
        currentAge: input.currentAge,
        retirementAge: input.retirementAge,
        lifeExpectancy: input.lifeExpectancy,
        monthlyRetirementSpendingToday: input.monthlyRetirementSpendingToday,
        annualInflation: input.annualInflation,
        annualReturn: input.annualReturn,
        cpfLifeMonthly: result.cpfLifeMonthly,
        payoutAge: input.cpf.payoutAge,
        includeCpf: input.includeCpf,
        cashAtRetirement: result.projectedCashAtRetirement,
        endingBalance: result.endingBalance,
        canRetire: result.canRetire,
      }),
    };
  };

  it("adds the sentence for the default plan and hides it when spending is above the real return", () => {
    const { result, sentence } = sentenceFor(defaults);
    const years = defaults.retirementAge - defaults.currentAge;
    const todayAtRetirement = inTodaysMoney(result.projectedCashAtRetirement, years, defaults.annualInflation);
    const todayAtLifeExpectancy = inTodaysMoney(
      result.endingBalance,
      defaults.lifeExpectancy - defaults.currentAge,
      defaults.annualInflation,
    );
    const net =
      defaults.monthlyRetirementSpendingToday * (1 + defaults.annualInflation) ** years * 12 -
      result.cpfLifeMonthly * 12;
    const spendRate = net / result.projectedCashAtRetirement;
    const afterInflation = realAnnualReturn(defaults.annualReturn, defaults.annualInflation);
    expect(result.canRetire).toBe(true);
    expect(todayAtLifeExpectancy).toBeGreaterThan(todayAtRetirement);
    expect(spendRate).toBeLessThan(afterInflation);
    expect(sentence).toMatch(/spend about \d+\.\d% of your savings a year/);
    expect(sentence).toMatch(/return after inflation, so your savings keep growing/);
    expect(sentence).toContain(`${(spendRate * 100).toFixed(1)}%`);
    expect(sentence).toContain(`${(afterInflation * 100).toFixed(1)}%`);

    const highSpend = sentenceFor({ ...defaults, monthlyRetirementSpendingToday: 20_000 });
    expect(highSpend.sentence).toBeNull();
  });

  it("hides the sentence for a shortfall plan", () => {
    const shortfall: PlanInput = {
      ...defaults,
      cashSavings: 0,
      monthlyIncome: 3_000,
      monthlyExpensesNow: 2_900,
      monthlyRetirementSpendingToday: 8_000,
      extraMonthlySaving: 0,
      includeCpf: false,
    };
    const { result, sentence } = sentenceFor(shortfall);
    expect(result.canRetire).toBe(false);
    expect(sentence).toBeNull();
  });

  it("hides the sentence when the first retirement year survives but today's money is lower at life expectancy", () => {
    const shrinking: PlanInput = {
      currentAge: 60,
      retirementAge: 65,
      lifeExpectancy: 95,
      cashSavings: 250_000,
      monthlyIncome: 0,
      annualIncomeGrowth: 0,
      monthlyExpensesNow: 0,
      monthlyRetirementSpendingToday: 1_500,
      annualReturn: 0.03,
      annualInflation: 0.025,
      extraMonthlySaving: 0,
      includeCpf: true,
      cpf: { oa: 0, sa: 0, ra: 330_100, ma: 0, payoutAge: 65 },
      loan: null,
      children: [],
    };
    const { result, sentence } = sentenceFor(shrinking);
    const years = shrinking.retirementAge - shrinking.currentAge;
    const yearly = shrinking.monthlyRetirementSpendingToday * (1 + shrinking.annualInflation) ** years * 12;
    const spendRate = (yearly - result.cpfLifeMonthly * 12) / result.projectedCashAtRetirement;
    const yearLater = result.series.find((point) => Math.abs(point.age - (shrinking.retirementAge + 1)) < 1e-6);
    const todayAtRetirement = inTodaysMoney(result.projectedCashAtRetirement, years, shrinking.annualInflation);
    const todayAtLifeExpectancy = inTodaysMoney(
      result.endingBalance,
      shrinking.lifeExpectancy - shrinking.currentAge,
      shrinking.annualInflation,
    );
    expect(result.canRetire).toBe(true);
    expect(yearLater && yearLater.balance).toBeGreaterThan(0);
    expect(spendRate).toBeLessThan(realAnnualReturn(shrinking.annualReturn, shrinking.annualInflation));
    expect(todayAtLifeExpectancy).toBeLessThan(todayAtRetirement);
    expect(sentence).toBeNull();
  });
});

describe("salary cap note", () => {
  it("adds the flat-ceiling sentence only when a projected salary rises above S$8,000", () => {
    expect(
      projectedSalaryExceedsCeiling({
        currentAge: 35,
        retirementAge: 55,
        monthlyIncome: 6_000,
        annualIncomeGrowth: 0.03,
      }),
    ).toBe(true);
    expect(
      projectedSalaryExceedsCeiling({
        currentAge: 40,
        retirementAge: 42,
        monthlyIncome: 8_000,
        annualIncomeGrowth: 0,
      }),
    ).toBe(false);
    expect(
      projectedSalaryExceedsCeiling({
        currentAge: 40,
        retirementAge: 42,
        monthlyIncome: 20_000,
        annualIncomeGrowth: 0,
      }),
    ).toBe(true);

    const above = calculatePlan({
      ...base,
      monthlyIncome: 9_000,
      monthlyExpensesNow: 1_000,
      includeCpf: true,
      cpf: { oa: 1_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
    });
    expect(above.salaryCapApplies).toBe(true);
    expect(estimateNotice(above)).toContain("The CPF salary cap after 2026 is assumed to stay at S$8,000.");

    const under = calculatePlan({
      ...base,
      monthlyIncome: 3_000,
      includeCpf: true,
      cpf: { oa: 1_000, sa: 0, ra: 0, ma: 0, payoutAge: 65 },
    });
    expect(under.salaryCapApplies).toBe(false);
    expect(estimateNotice(under)).not.toContain("salary cap");

    const withoutBalances = calculatePlan({ ...base, monthlyIncome: 9_000, includeCpf: false });
    expect(withoutBalances.salaryCapApplies).toBe(true);
    expect(estimateNotice(withoutBalances)).toContain("The CPF salary cap after 2026 is assumed to stay at S$8,000.");
  });
});
