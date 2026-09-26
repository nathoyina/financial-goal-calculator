"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EstimateTag } from "@/components/estimate-tag";
import { BalanceChart } from "@/components/balance-chart";
import { NumberField } from "@/components/number-field";
import {
  STEP_NAMES,
  track,
  verdictAnalyticsProps,
} from "@/lib/analytics/track";
import {
  BASIC_HEALTHCARE_SUM,
  CPF_INTEREST,
  CPF_LIFE_DEFERRAL,
  CPF_WAGE,
  ERS_MULTIPLE_OF_BRS,
  PLANNING_YEAR,
} from "@/lib/cpf/constants";
import { formatAge, formatMoney, formatPercent } from "@/lib/finance/format";
import {
  DEFAULT_PLAN_FORM,
  parseDecimal,
  parsePlanForm,
  type ChildForm,
  type FieldError,
  type PlanFormState,
} from "@/lib/finance/plan-form";

const VERDICT = 5;

function validateStep(step: number, form: PlanFormState): FieldError | null {
  if (step === 0) {
    const current = parseDecimal(form.currentAge);
    const retire = parseDecimal(form.retirementAge);
    const life = parseDecimal(form.lifeExpectancy);
    if (current === null) return { field: "currentAge", message: "Enter a number for current age." };
    if (retire === null) return { field: "retirementAge", message: "Enter a number for retirement age." };
    if (life === null) return { field: "lifeExpectancy", message: "Enter a number for life expectancy." };
    if (current < 0 || current > 120) return { field: "currentAge", message: "Current age must be between 0 and 120." };
    if (retire <= current) {
      return { field: "retirementAge", message: "Retirement age has to be after your current age. Early and late ages are both fine." };
    }
    if (life <= retire) return { field: "lifeExpectancy", message: "Life expectancy has to be after the retirement age." };
  }
  if (step === 1) {
    const fields: [keyof PlanFormState, string][] = [
      ["monthlyIncome", "monthly income"],
      ["annualIncomeGrowth", "income growth"],
      ["monthlyExpensesNow", "monthly expenses"],
      ["monthlyRetirementSpendingToday", "retirement spending"],
      ["cashSavings", "cash savings"],
      ["extraMonthlySaving", "extra monthly saving"],
      ["annualReturn", "annual return"],
      ["annualInflation", "inflation"],
    ];
    for (const [key, label] of fields) {
      if (parseDecimal(String(form[key])) === null) return { field: key, message: `Enter a number for ${label}.` };
    }
  }
  if (step === 2 && form.hasLoan) {
    if (parseDecimal(form.loanBalance) === null) return { field: "loanBalance", message: "Enter the loan balance." };
    if (parseDecimal(form.loanRate) === null) return { field: "loanRate", message: "Enter the loan interest rate." };
    if (parseDecimal(form.loanYears) === null) return { field: "loanYears", message: "Enter how many years are left." };
    if (form.loanInstalment.trim() !== "" && parseDecimal(form.loanInstalment) === null) {
      return { field: "loanInstalment", message: "Enter a number for the instalment, or leave it blank." };
    }
  }
  if (step === 3 && form.includeCpf) {
    const fields: [keyof PlanFormState, string][] = [
      ["oa", "Ordinary Account"],
      ["sa", "Special Account"],
      ["ra", "Retirement Account"],
      ["ma", "MediSave"],
      ["payoutAge", "CPF LIFE payout age"],
    ];
    for (const [key, label] of fields) {
      if (parseDecimal(String(form[key])) === null) return { field: key, message: `Enter a number for ${label}.` };
    }
  }
  if (step === 4) {
    for (const child of form.children) {
      if (parseDecimal(child.currentAge) === null) return { field: "childAge", message: "Enter the child’s age." };
      if (parseDecimal(child.startAge) === null) return { field: "childStartAge", message: "Enter the age costs start." };
      if (parseDecimal(child.years) === null) return { field: "childYears", message: "Enter how many years of costs to plan for." };
      if (parseDecimal(child.yearlyCostToday) === null) {
        return { field: "childCost", message: "Enter the yearly education cost." };
      }
    }
  }
  return null;
}

export function PlannerApp() {
  const [form, setForm] = useState<PlanFormState>(DEFAULT_PLAN_FORM);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<FieldError | null>(null);
  const started = useRef(false);
  const verdictSeen = useRef(false);

  useEffect(() => {
    track("Landing Viewed");
  }, []);

  useEffect(() => {
    if (step < VERDICT) track("Step Viewed", { step: STEP_NAMES[step] });
  }, [step]);

  useEffect(() => {
    const mark = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches("input, select, textarea")) {
        document.documentElement.dataset.typing = "true";
      }
    };
    const clear = () => {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement) || !active.matches("input, select, textarea")) {
          delete document.documentElement.dataset.typing;
        }
      });
    };
    document.addEventListener("focusin", mark);
    document.addEventListener("focusout", clear);
    return () => {
      document.removeEventListener("focusin", mark);
      document.removeEventListener("focusout", clear);
      delete document.documentElement.dataset.typing;
    };
  }, []);

  const parsed = useMemo(() => (step === VERDICT ? parsePlanForm(form) : null), [form, step]);
  const analyticsKey =
    step === VERDICT && parsed?.ok
      ? JSON.stringify(
          verdictAnalyticsProps({
            outcome: parsed.result.canRetire ? "on-track" : "shortfall",
            gap: parsed.result.gap,
            retirementAge: parsed.input.retirementAge,
            hasHousingLoan: parsed.input.loan !== null,
            hasChildren: parsed.input.children.length > 0,
            reliesOnEstimate: parsed.result.reliesOnEstimate,
          }),
        )
      : "";

  useEffect(() => {
    if (!analyticsKey) return;
    verdictSeen.current = true;
    track("Verdict Viewed", JSON.parse(analyticsKey) as Record<string, string | number | boolean>);
  }, [analyticsKey]);

  const update = (patch: Partial<PlanFormState>, source: "user" | "suggestion" = "user") => {
    if (!started.current) {
      started.current = true;
      track("Calculator Started");
    }
    if (verdictSeen.current && source === "user") track("Inputs Adjusted After Verdict");
    setError(null);
    setForm((current) => ({ ...current, ...patch }));
  };

  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);

  const goNext = (mode: "complete" | "skip") => {
    if (!started.current) {
      started.current = true;
      track("Calculator Started");
    }
    if (mode === "skip") {
      track("Step Skipped", { step: STEP_NAMES[step] });
      if (step === 2) update({ hasLoan: false }, "suggestion");
      if (step === 3) update({ includeCpf: false }, "suggestion");
      if (step === 4) update({ children: [] }, "suggestion");
      setStep((current) => current + 1);
      return;
    }
    const problem = validateStep(step, mode === "complete" && step === 3 ? { ...form, includeCpf: true } : form);
    if (problem) {
      track("Input Validation Error", { field: problem.field });
      setError(problem);
      return;
    }
    if (step === 3) update({ includeCpf: true }, "suggestion");
    track("Step Completed", { step: STEP_NAMES[step] });
    setStep((current) => current + 1);
  };

  const income = parseDecimal(form.monthlyIncome);
  const expenses = parseDecimal(form.monthlyExpensesNow);
  const leftBeforeCpf = income !== null && expenses !== null ? income - expenses : null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="relative overflow-hidden bg-onyx text-white">
        <div className={`mx-auto w-full max-w-3xl px-4 sm:px-6 ${step === 0 ? "pt-10 pb-28 sm:pt-16 sm:pb-40" : "pt-6 pb-16 sm:pb-20"}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">financial-goal-calculator</p>
          {step === 0 ? (
            <>
              <h1 className="mt-4 max-w-4xl text-5xl font-extrabold tracking-tight text-balance text-white sm:text-7xl lg:text-8xl">
                Can you retire?
              </h1>
              <p className="mt-5 max-w-md text-sm font-medium leading-relaxed text-muted sm:text-base">
                A Singapore check for the age you choose. Income, a home loan, CPF, and education all change the answer.
                Nothing leaves this browser.
              </p>
            </>
          ) : (
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">Can you retire?</h1>
          )}
        </div>
        <div className="wave-drift pointer-events-none absolute right-0 -bottom-px left-0 h-16 w-[140%] sm:h-24" aria-hidden="true">
          <svg className="h-full w-full max-w-none" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path fill="#171717" d="M0 78c180 46 260-70 480-34s250 72 430 28 250-78 530-18v66H0Z" />
          </svg>
        </div>
      </header>

      <main className={`relative z-10 flex-1 bg-charcoal px-4 sm:px-6 ${step === VERDICT ? "-mt-6 pt-2 pb-10" : "py-6 sm:py-8"}`}>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              {step < VERDICT ? `Step ${step + 1} of 5 · ${STEP_NAMES[step]}` : "Your verdict"}
            </p>
            <div className="mt-2 flex gap-2" aria-hidden="true">
              {STEP_NAMES.map((name, index) => (
                <div key={name} className={`h-1.5 flex-1 rounded-full ${index <= Math.min(step, 4) ? "bg-white" : "bg-[#333]"}`} />
              ))}
            </div>
          </div>

          <div key={step} className="step-rise flex flex-col gap-6">
          {step === 0 ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold tracking-tight">When do you want to stop working?</h2>
              <NumberField id="current-age" label="Current age" hint="Any age from a first job to a late career." value={form.currentAge} onChange={(value) => update({ currentAge: value })} suffix="years" error={fieldError("currentAge")} />
              <NumberField id="retirement-age" label="Retirement age" hint="40, 65, 72: any age after today and before the planning age." value={form.retirementAge} onChange={(value) => update({ retirementAge: value })} suffix="years" error={fieldError("retirementAge")} />
              <NumberField id="life-expectancy" label="Plan until age" hint="How long the money should last. A planning age, not a prediction." value={form.lifeExpectancy} onChange={(value) => update({ lifeExpectancy: value })} suffix="years" error={fieldError("lifeExpectancy")} />
            </section>
          ) : null}

          {step === 1 ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold tracking-tight">Income and spending</h2>
              <p className="text-sm leading-6 text-muted">
                What you can save is income minus spending, then minus CPF and any cash loan on the next steps.
              </p>
              <NumberField id="income" label="Gross monthly income" hint="Salary before CPF. Growth below raises this each year until you retire." value={form.monthlyIncome} onChange={(value) => update({ monthlyIncome: value })} prefix="S$" error={fieldError("monthlyIncome")} />
              <NumberField id="income-growth" label="Expected income growth" hint="Optional. Leave 0 if you do not want to assume raises." value={form.annualIncomeGrowth} onChange={(value) => update({ annualIncomeGrowth: value })} suffix="%" error={fieldError("annualIncomeGrowth")} />
              <NumberField id="expenses-now" label="Monthly expenses now" hint="Living costs you pay from take-home pay, in today’s prices." value={form.monthlyExpensesNow} onChange={(value) => update({ monthlyExpensesNow: value })} prefix="S$" error={fieldError("monthlyExpensesNow")} />
              <NumberField id="expenses-later" label="Monthly spending in retirement" hint="What you want to spend each month after you stop work, in today’s prices." value={form.monthlyRetirementSpendingToday} onChange={(value) => update({ monthlyRetirementSpendingToday: value })} prefix="S$" error={fieldError("monthlyRetirementSpendingToday")} />
              <NumberField id="cash" label="Cash savings" hint="Money outside CPF that you can invest and later spend." value={form.cashSavings} onChange={(value) => update({ cashSavings: value })} prefix="S$" error={fieldError("cashSavings")} />
              <NumberField id="extra" label="Extra monthly saving" hint="On top of whatever income minus spending leaves. Start at 0." value={form.extraMonthlySaving} onChange={(value) => update({ extraMonthlySaving: value })} prefix="S$" error={fieldError("extraMonthlySaving")} />
              <NumberField id="return" label="Expected annual return" hint="Nominal return on cash savings, before inflation." value={form.annualReturn} onChange={(value) => update({ annualReturn: value })} suffix="%" error={fieldError("annualReturn")} />
              <NumberField id="inflation" label="Expected inflation" hint="How fast prices, and your spending, rise each year." value={form.annualInflation} onChange={(value) => update({ annualInflation: value })} suffix="%" error={fieldError("annualInflation")} />
              {leftBeforeCpf !== null ? (
                <p className="text-sm leading-6 text-muted">
                  {leftBeforeCpf >= 0
                    ? `Before CPF and a home loan, about ${formatMoney(leftBeforeCpf)} a month is left from income after spending.`
                    : `Spending is above income by about ${formatMoney(-leftBeforeCpf)} a month, before CPF and a home loan.`}
                </p>
              ) : null}
            </section>
          ) : null}

          {step === 2 ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold tracking-tight">Home loan</h2>
              <p className="text-sm leading-6 text-muted">Optional. Payments reduce what you can save until the loan ends.</p>
              <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={form.hasLoan}
                  onChange={(event) => update({ hasLoan: event.target.checked })}
                />
                I am still paying a home loan
              </label>
              {form.hasLoan ? (
                <>
                  <NumberField id="loan-balance" label="Outstanding balance" hint="What you still owe." value={form.loanBalance} onChange={(value) => update({ loanBalance: value })} prefix="S$" error={fieldError("loanBalance")} />
                  <NumberField id="loan-rate" label="Interest rate" hint={`Your loan rate. The starting figure is the ${CPF_INTEREST.hdbConcessionary.year} HDB concessionary rate of ${formatPercent(CPF_INTEREST.hdbConcessionary.value)}. Replace it with your own. Monthly rest. This plan does not charge CPF accrued interest on housing withdrawals, because that rate was not confirmed.`} value={form.loanRate} onChange={(value) => update({ loanRate: value })} suffix="%" error={fieldError("loanRate")} />
                  <NumberField id="loan-years" label="Years left" hint="Remaining tenure." value={form.loanYears} onChange={(value) => update({ loanYears: value })} suffix="years" error={fieldError("loanYears")} />
                  <NumberField id="loan-instalment" label="Monthly instalment" hint="Optional. Leave blank to calculate it from the balance, rate, and years." value={form.loanInstalment} onChange={(value) => update({ loanInstalment: value })} prefix="S$" error={fieldError("loanInstalment")} />
                  <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="loan-from">
                    Paid from
                    <select id="loan-from" value={form.loanPaidFrom} onChange={(event) => update({ loanPaidFrom: event.target.value as "cash" | "oa" })} className="h-12 rounded-full border border-border bg-void px-4 text-base text-white focus-visible:border-yellow focus-visible:ring-2 focus-visible:ring-yellow">
                      <option value="oa">CPF Ordinary Account</option>
                      <option value="cash">Cash</option>
                    </select>
                    <span className="font-normal text-muted">OA payments reduce the Ordinary Account. Cash payments reduce what you can save.</span>
                  </label>
                </>
              ) : null}
            </section>
          ) : null}

          {step === 3 ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold tracking-tight">CPF balances</h2>
              <p className="text-sm leading-6 text-muted">
                SGFinDex is not available to this app. It is reached through participating banks and government services
                with Singpass, and there is no public API for an independent calculator. Enter the balances yourself, or skip.
              </p>
              <NumberField id="oa" label="Ordinary Account (OA)" hint={`Savings that can pay a home loan. This plan uses the ${CPF_INTEREST.ordinaryAccount.year} floor rate of ${formatPercent(CPF_INTEREST.ordinaryAccount.value)}.`} value={form.oa} onChange={(value) => update({ oa: value })} prefix="S$" error={fieldError("oa")} />
              <NumberField id="sa" label="Special Account (SA)" hint="Closed at 55. Moved into the Retirement Account up to the Full Retirement Sum. Anything above that goes back to the OA." value={form.sa} onChange={(value) => update({ sa: value })} prefix="S$" error={fieldError("sa")} />
              <NumberField id="ra" label="Retirement Account (RA)" hint="Usually 0 before 55. This is what CPF LIFE is estimated from." value={form.ra} onChange={(value) => update({ ra: value })} prefix="S$" error={fieldError("ra")} />
              <NumberField id="ma" label="MediSave (MA)" hint={`Kept for healthcare. The ${BASIC_HEALTHCARE_SUM.year} Basic Healthcare Sum is ${formatMoney(BASIC_HEALTHCARE_SUM.value)}. It is not spent on living costs here.`} value={form.ma} onChange={(value) => update({ ma: value })} prefix="S$" error={fieldError("ma")} />
              <NumberField id="payout-age" label="CPF LIFE payout age" hint={`From ${CPF_LIFE_DEFERRAL.earliestAge} to ${CPF_LIFE_DEFERRAL.latestAge}. Later ages use CPF’s “up to ${formatPercent(CPF_LIFE_DEFERRAL.perYear)} a year” deferral as an estimate, capped at ${formatPercent(CPF_LIFE_DEFERRAL.maxIncrease)}.`} value={form.payoutAge} onChange={(value) => update({ payoutAge: value })} suffix="years" error={fieldError("payoutAge")} />
            </section>
          ) : null}

          {step === 4 ? (
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold tracking-tight">Children’s education</h2>
              <p className="text-sm leading-6 text-muted">
                Optional. Each study year is taken from cash savings, inflated from today’s prices. Local or overseas is only a label. You type the cost.
              </p>
              {form.children.map((child, index) => (
                <fieldset key={child.id} className="flex flex-col gap-4 rounded-[32px] border border-border p-4">
                  <legend className="px-1 text-sm font-semibold">Child {index + 1}</legend>
                  <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor={`path-${child.id}`}>
                    Path
                    <select
                      id={`path-${child.id}`}
                      value={child.path}
                      onChange={(event) => {
                        const path = event.target.value as ChildForm["path"];
                        update({
                          children: form.children.map((item) => (item.id === child.id ? { ...item, path } : item)),
                        });
                      }}
                      className="h-12 rounded-full border border-border bg-void px-4 text-base text-white focus-visible:border-yellow focus-visible:ring-2 focus-visible:ring-yellow"
                    >
                      <option value="local">Local university</option>
                      <option value="overseas">Overseas university</option>
                      <option value="other">Other</option>
                    </select>
                    <span className="font-normal text-muted">Does not fill in a fee. Overseas plans are often higher. Use your own yearly figure.</span>
                  </label>
                  <NumberField id={`child-age-${child.id}`} label="Child’s age now" hint="Used to time the costs." value={child.currentAge} onChange={(value) => update({ children: form.children.map((item) => item.id === child.id ? { ...item, currentAge: value } : item) })} suffix="years" error={fieldError("childAge")} />
                  <NumberField id={`child-start-${child.id}`} label="Age costs start" hint="Often 18 or 19 for university." value={child.startAge} onChange={(value) => update({ children: form.children.map((item) => item.id === child.id ? { ...item, startAge: value } : item) })} suffix="years" error={fieldError("childStartAge")} />
                  <NumberField id={`child-years-${child.id}`} label="Years of costs" hint="One withdrawal a year. Use 1 year for a single lump sum." value={child.years} onChange={(value) => update({ children: form.children.map((item) => item.id === child.id ? { ...item, years: value } : item) })} suffix="years" error={fieldError("childYears")} />
                  <NumberField id={`child-cost-${child.id}`} label="Yearly cost" hint="Fees and living costs for one year, in today’s prices." value={child.yearlyCostToday} onChange={(value) => update({ children: form.children.map((item) => item.id === child.id ? { ...item, yearlyCostToday: value } : item) })} prefix="S$" error={fieldError("childCost")} />
                  <button type="button" className="pill pill-ghost self-start text-sm" onClick={() => update({ children: form.children.filter((item) => item.id !== child.id) })}>
                    Remove
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                className="pill pill-ghost self-start text-sm"
                onClick={() =>
                  update({
                    children: [
                      ...form.children,
                      { id: `child-${Date.now()}`, currentAge: "", startAge: "19", years: "3", yearlyCostToday: "", path: "local" },
                    ],
                  })
                }
              >
                Add a child
              </button>
              {error && ["childAge", "childStartAge", "childYears", "childCost"].includes(error.field) ? (
                <p role="alert" className="text-sm text-danger">{error.message}</p>
              ) : null}
            </section>
          ) : null}

          {step === VERDICT ? (
            <Verdict
              parsed={parsed}
              form={form}
              onApply={update}
              onOpenEstimate={(figure) => track("Estimate Info Opened", { figure })}
            />
          ) : null}

          <div className="flex flex-wrap gap-3">
            {step > 0 ? (
              <button type="button" className="pill pill-ghost" onClick={() => setStep((current) => current - 1)}>
                Back
              </button>
            ) : null}
            {step < VERDICT ? (
              <button type="button" className="pill pill-shout" onClick={() => goNext("complete")}>
                {step === 4 ? "See the verdict" : "Continue"}
              </button>
            ) : null}
            {step >= 2 && step < VERDICT ? (
              <button type="button" className="pill pill-ghost" onClick={() => goNext("skip")}>
                Skip
              </button>
            ) : null}
          </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Verdict({
  form,
  parsed,
  onApply,
  onOpenEstimate,
}: {
  form: PlanFormState;
  parsed: ReturnType<typeof parsePlanForm> | null;
  onApply: (patch: Partial<PlanFormState>, source?: "user" | "suggestion") => void;
  onOpenEstimate: (figure: string) => void;
}) {
  if (!parsed || !parsed.ok) {
    return (
      <p role="alert" className="text-sm leading-6 text-danger">
        {parsed && !parsed.ok ? parsed.error.message : "Check the inputs."}
      </p>
    );
  }
  const { input, result } = parsed;
  const gap = formatMoney(Math.abs(result.gap));
  const sentence = result.canRetire
    ? `Yes. You can retire at ${formatAge(input.retirementAge)}.`
    : `No. You cannot retire at ${formatAge(input.retirementAge)} on this plan.`;
  const detail = result.canRetire
    ? `Cash at retirement is about ${gap} ${result.gap >= 0 ? "above" : "around"} the nest egg, and the balance lasts until ${formatAge(input.lifeExpectancy)}.`
    : `The gap at retirement is about ${gap}. ${
        result.moneyRunsOutAge === null
          ? ""
          : `Savings run out at age ${formatAge(result.moneyRunsOutAge)}.`
      }`;

  return (
    <section className="flex flex-col gap-5" aria-live="polite">
      <div className="glass p-5 sm:p-8">
        <h2 className="text-4xl font-extrabold tracking-tight text-balance text-yellow sm:text-5xl">{sentence}</h2>
        <p className="mt-3 text-base leading-7 text-white">{detail}</p>
        {result.reliesOnEstimate ? (
          <p className="mt-3 text-sm leading-6 text-muted">
            Part of this result depends on an estimate. Each Estimate tag below names the figure, including a retirement sum after 2027 and anything CPF has not published. A tag that says the plan does not apply a figure means that number was left out on purpose.
          </p>
        ) : null}
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="glass p-5">
          <dt className="text-sm text-muted">Nest egg needed</dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{formatMoney(result.nestEggNeeded)}</dd>
          <p className="mt-2 text-sm leading-5 text-muted">Cash required when you retire, after CPF LIFE, to last until the planning age.</p>
        </div>
        <div className="glass p-5">
          <dt className="text-sm text-muted">{result.gap >= 0 ? "Surplus" : "Gap"}</dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{gap}</dd>
          <p className="mt-2 text-sm leading-5 text-muted">
            Projected cash at retirement is {formatMoney(result.projectedCashAtRetirement)}. The {result.gap >= 0 ? "surplus" : "gap"} is that amount minus the nest egg.
          </p>
        </div>
        <div className="glass p-5">
          <dt className="flex flex-wrap items-center gap-2 text-sm text-muted">
            CPF LIFE payout
            {input.includeCpf ? (
              <EstimateTag
                id="cpf-life-payout"
                explanation={result.estimates.find((note) => note.id === "cpf-life-payout")?.explanation ?? "Estimated payout."}
                onOpen={() => onOpenEstimate("cpf-life-payout")}
              />
            ) : null}
          </dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
            {input.includeCpf ? `${formatMoney(result.cpfLifeMonthly)} / mo` : "Not included"}
          </dd>
          <p className="mt-2 text-sm leading-5 text-muted">
            {input.includeCpf
              ? "A flat monthly amount from the payout age. It does not rise with inflation."
              : "You skipped CPF, so no payout is counted."}
          </p>
        </div>
        <div className="glass p-5">
          <dt className="text-sm text-muted">Left to save today</dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{formatMoney(result.monthlySavingToday)}</dd>
          <p className="mt-2 text-sm leading-5 text-muted">Income minus CPF, spending, and a cash loan instalment, plus any extra you entered.</p>
        </div>
      </dl>

      {!result.canRetire ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-bold">What would fix it</h3>
          {result.earliestRetirementAge !== null ? (
            <button type="button" className="pill pill-shout text-left" onClick={() => { track("Gap Suggestion Applied", { type: "earliest-age" }); onApply({ retirementAge: String(result.earliestRetirementAge) }, "suggestion"); }}>
              Retire at {result.earliestRetirementAge} instead
            </button>
          ) : (
            <p className="text-sm leading-6 text-muted">No later age before the planning age makes this spending last.</p>
          )}
          {result.extraMonthlySaving !== null ? (
            <button type="button" className="pill pill-ghost text-left" onClick={() => { track("Gap Suggestion Applied", { type: "extra-saving" }); onApply({ extraMonthlySaving: String(Math.ceil(Number(form.extraMonthlySaving) + result.extraMonthlySaving!)) }, "suggestion"); }}>
              Save {formatMoney(result.extraMonthlySaving)} more each month
            </button>
          ) : null}
          {result.spendingCutToday !== null ? (
            <button type="button" className="pill pill-ghost text-left" onClick={() => { track("Gap Suggestion Applied", { type: "spending-cut" }); onApply({ monthlyRetirementSpendingToday: String(Math.max(0, Math.floor(input.monthlyRetirementSpendingToday - result.spendingCutToday!))) }, "suggestion"); }}>
              Spend {formatMoney(result.spendingCutToday)} less each month in retirement
            </button>
          ) : null}
        </div>
      ) : null}

      <div>
        <h3 className="text-lg font-bold">Balance over time</h3>
        <p className="mt-1 text-sm leading-5 text-muted">White is the working years. The lighter line is retirement. Cash only, after any OA moved in at 55 or retirement.</p>
        <BalanceChart
          series={result.series}
          retirementAge={input.retirementAge}
          lifeExpectancy={input.lifeExpectancy}
          moneyRunsOutAge={result.moneyRunsOutAge}
          currency="SGD"
        />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-bold">Assumptions you should read</h3>
        {result.estimates.map((note) => (
          <div key={note.id} className="flex flex-col items-start gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium text-white">{note.title}</p>
              <EstimateTag id={`${note.id}-assumption`} explanation={note.explanation} onOpen={() => onOpenEstimate(note.id)} />
            </div>
          </div>
        ))}
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          <li>Contributions use the published citizen rates for each calendar year, on wages above {formatMoney(CPF_WAGE.fullRateAbove.value)}, capped at the {formatMoney(CPF_WAGE.ordinaryCeiling.value)} ordinary wage ceiling from {PLANNING_YEAR}. Senior-worker rates use the published 2027 table from January 2027, then stay on that table. Additional wages are not modelled. The annual wage ceiling is {formatMoney(CPF_WAGE.annualCeiling.value)}.</li>
          <li>The Full Retirement Sum, not a voluntary top-up to the Enhanced Retirement Sum, is set aside at 55. From {ERS_MULTIPLE_OF_BRS.sinceYear} the Enhanced Retirement Sum is {ERS_MULTIPLE_OF_BRS.value} times the Basic Retirement Sum.</li>
          <li>Interest is calculated on each month’s balance and added once a year. It is not monthly compounding.</li>
          <li>MediSave is not used for living costs. Ordinary Account savings move into spendable cash at retirement, or at 55 if you retire earlier, unless an OA loan is still running.</li>
        </ul>
      </div>

      <aside className="rounded-[32px] border border-white/45 p-5">
        <h3 className="text-sm font-semibold text-white">Not financial advice</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          This is an estimate for planning, not a CPF quote and not a recommendation. Markets, inflation, CPF rules, and your spending will differ. Check the figures with CPF Board or a licensed adviser before you act.
        </p>
      </aside>
    </section>
  );
}
