"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { EstimateTag } from "@/components/estimate-tag";
import { BalanceChart } from "@/components/balance-chart";
import { NumberField } from "@/components/number-field";
import {
  STEP_NAMES,
  stepCompletedProps,
  track,
  shouldTrackAdjustmentAfterVerdict,
  verdictAnalyticsProps,
} from "@/lib/analytics/track";
import {
  BASIC_HEALTHCARE_SUM,
  CPF_INTEREST,
  CPF_LIFE_DEFERRAL,
  CPF_WAGE,
  ENHANCED_RETIREMENT_SUM,
  PLANNING_YEAR,
} from "@/lib/cpf/constants";
import { formatAge, formatMoney, formatPercent } from "@/lib/finance/format";
import {
  cpfLifeDollarYear,
  cpfLifeInTodaysMoney,
  monthlySavingCard,
  savingsKeepGrowingSentence,
  spendingExceedsTakeHome,
  takeHomeExcessSentence,
  yearsUntilRetirementLine,
} from "@/lib/finance/guidance";
import { pressOptionalButton, showsContinue } from "@/lib/finance/optional-step";
import { estimateNotice } from "@/lib/finance/plan";
import {
  DEFAULT_PLAN_FORM,
  parseDecimal,
  parsePlanForm,
  validateStep,
  type ChildForm,
  type FieldError,
  type OptionalAnswer,
  type PlanFormState,
} from "@/lib/finance/plan-form";

const VERDICT = 5;
const HEADING_ID = "planner-heading";
const HOUSING_HINT_ID = "housing-exclusion";

const FIELD_IDS: Record<string, string> = {
  currentAge: "current-age",
  retirementAge: "retirement-age",
  lifeExpectancy: "life-expectancy",
  monthlyIncome: "income",
  annualIncomeGrowth: "income-growth",
  monthlyExpensesNow: "expenses-now",
  monthlyRetirementSpendingToday: "expenses-later",
  cashSavings: "cash",
  extraMonthlySaving: "extra",
  annualReturn: "return",
  annualInflation: "inflation",
  loanBalance: "loan-balance",
  loanRate: "loan-rate",
  loanYears: "loan-years",
  loanInstalment: "loan-instalment",
  oa: "oa",
  sa: "sa",
  ra: "ra",
  ma: "ma",
  payoutAge: "payout-age",
  addChild: "add-child",
};

export function PlannerApp() {
  const [form, setForm] = useState<PlanFormState>(DEFAULT_PLAN_FORM);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<FieldError | null>(null);
  const started = useRef(false);
  const verdictSeen = useRef(false);
  const firstVerdict = useRef(true);
  const adjustmentTracked = useRef(false);
  const [headingFocus, setHeadingFocus] = useState(0);

  const requestHeadingFocus = () => setHeadingFocus((current) => current + 1);

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
            hasCpf: parsed.input.includeCpf,
            hasChildren: parsed.input.children.length > 0,
            reliesOnEstimate: parsed.result.reliesOnEstimate,
            isFirstVerdict: false,
            spendingExceedsTakeHome: spendingExceedsTakeHome(parsed.input),
          }),
        )
      : "";

  useEffect(() => {
    if (!analyticsKey) return;
    const props = JSON.parse(analyticsKey) as Record<string, string | number | boolean>;
    props.is_first_verdict = firstVerdict.current;
    firstVerdict.current = false;
    adjustmentTracked.current = false;
    verdictSeen.current = true;
    track("Verdict Viewed", props);
  }, [analyticsKey]);

  const update = (patch: Partial<PlanFormState>, source: "user" | "suggestion" = "user") => {
    if (!started.current) {
      started.current = true;
      track("Calculator Started");
    }
    if (
      shouldTrackAdjustmentAfterVerdict({
        verdictSeen: verdictSeen.current,
        alreadyTrackedForThisVerdict: adjustmentTracked.current,
        source,
      })
    ) {
      track("Inputs Adjusted After Verdict");
      adjustmentTracked.current = true;
    }
    setError(null);
    setForm((current) => ({ ...current, ...patch }));
    if (source === "suggestion") requestHeadingFocus();
  };

  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);
  const noAdvanceLock = useRef(false);

  useEffect(() => {
    noAdvanceLock.current = false;
  }, [step]);

  const activateOptional = (button: "yes" | "no", activation: string) => {
    const result = pressOptionalButton({
      step,
      form,
      button,
      activation,
      locked: noAdvanceLock.current,
    });
    noAdvanceLock.current = result.locked;
    if (result.form === form) return;
    update(result.form);
    if (result.completed && result.nextStep !== null) {
      track("Step Completed", result.completed);
      setStep(result.nextStep);
      requestHeadingFocus();
    }
  };

  const goNext = () => {
    if (!started.current) {
      started.current = true;
      track("Calculator Started");
    }
    const answer =
      step === 2 ? form.loanAnswer : step === 3 ? form.cpfAnswer : step === 4 ? form.childrenAnswer : null;
    if (step >= 2 && step <= 4 && answer !== "yes") return;
    const problem = validateStep(step, form);
    if (problem) {
      track("Input Validation Error", { field: problem.field, reason: problem.reason });
      setError(problem);
      return;
    }
    const stepName = STEP_NAMES[step];
    if (stepName) {
      track("Step Completed", stepCompletedProps(stepName, answer === "yes" ? "yes" : undefined));
    }
    setStep((current) => current + 1);
    requestHeadingFocus();
  };

  useLayoutEffect(() => {
    if (headingFocus === 0) return;
    const heading = document.getElementById(HEADING_ID);
    window.scrollTo(0, 0);
    heading?.focus({ preventScroll: true });
  }, [headingFocus]);

  useLayoutEffect(() => {
    if (!error) return;
    const mapped = FIELD_IDS[error.field];
    const node =
      (mapped ? document.getElementById(mapped) : null) ??
      document.querySelector<HTMLElement>("[aria-invalid='true']");
    node?.focus();
  }, [error]);

  const income = parseDecimal(form.monthlyIncome);
  const expenses = parseDecimal(form.monthlyExpensesNow);
  const ageToday = parseDecimal(form.currentAge);
  const retireAt = parseDecimal(form.retirementAge);
  const yearsLine =
    ageToday !== null && retireAt !== null ? yearsUntilRetirementLine(ageToday, retireAt) : null;
  const leftBeforeCpf = income !== null && expenses !== null ? income - expenses : null;
  const takeHomeNote =
    income !== null && expenses !== null && ageToday !== null
      ? takeHomeExcessSentence({
          currentAge: ageToday,
          monthlyIncome: income,
          monthlyExpensesNow: expenses,
        })
      : null;

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
              <h2 id={HEADING_ID} tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none">
                At what age do you want to retire?
              </h2>
              <NumberField id="current-age" label="Your age today" hint="Any age from a first job to a late career." value={form.currentAge} onChange={(value) => update({ currentAge: value })} suffix="years" error={fieldError("currentAge")} />
              <NumberField id="retirement-age" label="Retirement age" hint="40, 65, 72: any age after today and before the planning age." value={form.retirementAge} onChange={(value) => update({ retirementAge: value })} suffix="years" error={fieldError("retirementAge")} note={yearsLine} noteTone={ageToday !== null && retireAt !== null && retireAt > ageToday ? "neutral" : "caution"} />
              <NumberField id="life-expectancy" label="Plan until age" hint="How long the money should last. A planning age, not a prediction." value={form.lifeExpectancy} onChange={(value) => update({ lifeExpectancy: value })} suffix="years" error={fieldError("lifeExpectancy")} />
            </section>
          ) : null}

          {step === 1 ? (
            <section className="flex flex-col gap-4">
              <h2 id={HEADING_ID} tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none">
                Income and spending
              </h2>
              <p className="text-sm leading-6 text-muted">
                What you can save is income minus spending, then minus CPF and any cash loan on the next steps.
              </p>
              <NumberField id="income" label="Gross monthly income" hint="Salary before CPF. Growth below raises this each year until you retire." value={form.monthlyIncome} onChange={(value) => update({ monthlyIncome: value })} prefix="S$" error={fieldError("monthlyIncome")} />
              <NumberField id="income-growth" label="Expected income growth" hint="Optional. Leave 0 if you do not want to assume raises." value={form.annualIncomeGrowth} onChange={(value) => update({ annualIncomeGrowth: value })} suffix="%" error={fieldError("annualIncomeGrowth")} />
              <NumberField id="expenses-now" label="Monthly living costs, excluding home loan" hint="Leave out your home loan. Include rent, town council charges and property tax, in today’s prices." value={form.monthlyExpensesNow} onChange={(value) => update({ monthlyExpensesNow: value })} prefix="S$" error={fieldError("monthlyExpensesNow")} />
              {takeHomeNote ? (
                <p role="status" className="caution-note">
                  <CautionIcon />
                  <span>{takeHomeNote}</span>
                </p>
              ) : null}
              <NumberField id="expenses-later" label="Monthly spending in retirement" hint="Leave out your home loan. What you want to spend each month after you stop work, in today’s prices." value={form.monthlyRetirementSpendingToday} onChange={(value) => update({ monthlyRetirementSpendingToday: value })} prefix="S$" error={fieldError("monthlyRetirementSpendingToday")} />
              <NumberField id="cash" label="Cash savings" hint="Money outside CPF that you can invest and later spend." value={form.cashSavings} onChange={(value) => update({ cashSavings: value })} prefix="S$" error={fieldError("cashSavings")} />
              <NumberField id="extra" label="Other income you'd save each month" hint="Side income, rental or bonuses. Your salary savings are already counted." value={form.extraMonthlySaving} onChange={(value) => update({ extraMonthlySaving: value })} prefix="S$" error={fieldError("extraMonthlySaving")} />
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
              <h2 id={HEADING_ID} tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none">
                Are you still paying a home loan?
              </h2>
              <YesNoChoice
                value={form.loanAnswer}
                yesId="loan-yes"
                noId="loan-no"
                labelledBy={HEADING_ID}
                controlsId="loan-fields"
                onActivate={activateOptional}
              />
              <div id="loan-fields" hidden={form.loanAnswer !== "yes"}>
              {form.loanAnswer === "yes" ? (
                <>
                  <p id={HOUSING_HINT_ID} className="text-sm leading-6 text-muted">
                    Don’t include this in your monthly living costs. Payments reduce what you can save until the loan ends.
                  </p>
                  <NumberField id="loan-balance" label="Outstanding balance" hint="What you still owe." value={form.loanBalance} onChange={(value) => update({ loanBalance: value })} prefix="S$" error={fieldError("loanBalance")} describedByExtra={HOUSING_HINT_ID} />
                  <NumberField id="loan-rate" label="Interest rate" hint={`Your loan rate. The starting figure is the ${CPF_INTEREST.hdbConcessionary.year} HDB concessionary rate of ${formatPercent(CPF_INTEREST.hdbConcessionary.value)}. Replace it with your own. Monthly rest. This plan does not charge CPF accrued interest on housing withdrawals, because that rate was not confirmed.`} value={form.loanRate} onChange={(value) => update({ loanRate: value })} suffix="%" error={fieldError("loanRate")} describedByExtra={HOUSING_HINT_ID} />
                  <NumberField id="loan-years" label="Years left" hint="Remaining tenure." value={form.loanYears} onChange={(value) => update({ loanYears: value })} suffix="years" error={fieldError("loanYears")} describedByExtra={HOUSING_HINT_ID} />
                  <NumberField id="loan-instalment" label="Monthly instalment" hint="Optional. Leave blank to calculate it from the balance, rate, and years." value={form.loanInstalment} onChange={(value) => update({ loanInstalment: value })} prefix="S$" error={fieldError("loanInstalment")} describedByExtra={HOUSING_HINT_ID} />
                  <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="loan-from">
                    Paid from
                    <select id="loan-from" value={form.loanPaidFrom} aria-describedby={`${HOUSING_HINT_ID} loan-from-hint`} onChange={(event) => update({ loanPaidFrom: event.target.value as "cash" | "oa" })} className="h-12 rounded-full border border-border bg-void px-4 text-base text-white focus-visible:border-yellow focus-visible:ring-2 focus-visible:ring-yellow">
                      <option value="oa">CPF Ordinary Account</option>
                      <option value="cash">Cash</option>
                    </select>
                    <span id="loan-from-hint" className="font-normal text-muted">OA payments reduce the Ordinary Account. Cash payments reduce what you can save.</span>
                  </label>
                </>
              ) : null}
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="flex flex-col gap-4">
              <h2 id={HEADING_ID} tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none">
                Add your CPF balances to the plan?
              </h2>
              <p id="cpf-choice-hint" className="text-sm leading-5 text-muted">
                Your CPF contributions from salary are still counted either way.
              </p>
              <YesNoChoice
                value={form.cpfAnswer}
                yesId="cpf-yes"
                noId="cpf-no"
                labelledBy={HEADING_ID}
                hintId="cpf-choice-hint"
                controlsId="cpf-fields"
                onActivate={activateOptional}
              />
              <div id="cpf-fields" hidden={form.cpfAnswer !== "yes"}>
              {form.cpfAnswer === "yes" ? (
                <>
                  <p className="text-sm leading-6 text-muted">
                    SGFinDex is not available to this app. It is reached through participating banks and government services
                    with Singpass, and there is no public API for an independent calculator. Enter the balances yourself.
                  </p>
                  <NumberField id="oa" label="Ordinary Account (OA)" hint={`Savings that can pay a home loan. This plan uses the ${CPF_INTEREST.ordinaryAccount.year} floor rate of ${formatPercent(CPF_INTEREST.ordinaryAccount.value)}.`} value={form.oa} onChange={(value) => update({ oa: value })} prefix="S$" error={fieldError("oa")} />
                  <NumberField id="sa" label="Special Account (SA)" hint="Closed at 55. Moved into the Retirement Account up to the Full Retirement Sum. Anything above that goes back to the OA." value={form.sa} onChange={(value) => update({ sa: value })} prefix="S$" error={fieldError("sa")} />
                  <NumberField id="ra" label="Retirement Account (RA)" hint="Usually 0 before 55. This is what CPF LIFE is estimated from." value={form.ra} onChange={(value) => update({ ra: value })} prefix="S$" error={fieldError("ra")} />
                  <NumberField id="ma" label="MediSave (MA)" hint={`Kept for healthcare. The ${BASIC_HEALTHCARE_SUM.year} Basic Healthcare Sum is ${formatMoney(BASIC_HEALTHCARE_SUM.value)}. It is not spent on living costs here.`} value={form.ma} onChange={(value) => update({ ma: value })} prefix="S$" error={fieldError("ma")} />
                  <NumberField id="payout-age" label="CPF LIFE payout age" hint={`From ${CPF_LIFE_DEFERRAL.earliestAge} to ${CPF_LIFE_DEFERRAL.latestAge}. Later ages use CPF’s “up to ${formatPercent(CPF_LIFE_DEFERRAL.perYear)} a year” deferral as an estimate, capped at ${formatPercent(CPF_LIFE_DEFERRAL.maxIncrease)}.`} value={form.payoutAge} onChange={(value) => update({ payoutAge: value })} suffix="years" error={fieldError("payoutAge")} />
                </>
              ) : null}
              </div>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="flex flex-col gap-4">
              <h2 id={HEADING_ID} tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none">
                Planning for children&apos;s education?
              </h2>
              <YesNoChoice
                value={form.childrenAnswer}
                yesId="children-yes"
                noId="children-no"
                labelledBy={HEADING_ID}
                controlsId="children-fields"
                onActivate={activateOptional}
              />
              <div id="children-fields" hidden={form.childrenAnswer !== "yes"}>
              {form.childrenAnswer === "yes" ? (
                <>
              <p className="text-sm leading-6 text-muted">
                Each study year is taken from cash savings, inflated from today’s prices. Local or overseas is only a label. You type the cost.
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
                id="add-child"
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
              {error && ["addChild", "childAge", "childStartAge", "childYears", "childCost"].includes(error.field) ? (
                <p role="alert" className="text-sm text-danger">{error.message}</p>
              ) : null}
                </>
              ) : null}
              </div>
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
              <button
                type="button"
                className="pill pill-ghost"
                onClick={() => {
                  setStep((current) => current - 1);
                  requestHeadingFocus();
                }}
              >
                Back
              </button>
            ) : null}
            {showsContinue(step, form) ? (
              <button type="button" className="pill pill-shout" onClick={goNext}>
                {step === 4 ? "See the verdict" : "Continue"}
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
      <section className="flex flex-col gap-3">
        <h2 id={HEADING_ID} tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none">
          Check the inputs
        </h2>
        <p role="alert" className="text-sm leading-6 text-danger">
          {parsed && !parsed.ok ? parsed.error.message : "Check the inputs."}
        </p>
      </section>
    );
  }
  const { input, result } = parsed;
  const notice = estimateNotice(result);
  const gap = formatMoney(Math.abs(result.gap));
  const surplus = result.gap >= 0;
  const takeHomeSentence = result.canRetire ? null : takeHomeExcessSentence(input);
  const payoutYear = cpfLifeDollarYear(input.currentAge, input.cpf.payoutAge);
  const payoutToday = cpfLifeInTodaysMoney({
    currentAge: input.currentAge,
    payoutAge: input.cpf.payoutAge,
    annualInflation: input.annualInflation,
    monthlyPayout: result.cpfLifeMonthly,
  });
  const savingNow = monthlySavingCard(result.monthlySavingToday);
  const growthSentence = savingsKeepGrowingSentence({
    currentAge: input.currentAge,
    retirementAge: input.retirementAge,
    monthlyRetirementSpendingToday: input.monthlyRetirementSpendingToday,
    annualInflation: input.annualInflation,
    annualReturn: input.annualReturn,
    cpfLifeMonthly: result.cpfLifeMonthly,
    payoutAge: input.cpf.payoutAge,
    includeCpf: input.includeCpf,
    cashAtRetirement: result.projectedCashAtRetirement,
  });
  const sentence = result.canRetire
    ? `Yes. You can retire at ${formatAge(input.retirementAge)}.`
    : `No. You cannot retire at ${formatAge(input.retirementAge)} on this plan.`;
  const detail = result.canRetire
    ? `Cash at retirement is about ${gap} ${surplus ? "above" : "around"} the nest egg, and the balance lasts until ${formatAge(input.lifeExpectancy)}.`
    : `The gap at retirement is about ${gap}. ${
        result.moneyRunsOutAge === null
          ? ""
          : `Savings run out at age ${formatAge(result.moneyRunsOutAge)}.`
      }`;

  return (
    <section className="flex flex-col gap-5" aria-live="polite">
      <div className="glass p-5 sm:p-8">
        <p className={result.canRetire ? "status-chip status-on-track" : "status-chip status-shortfall"}>
          {result.canRetire ? <CheckIcon /> : <ShortfallIcon />}
          {result.canRetire ? "On track" : "Shortfall"}
        </p>
        {takeHomeSentence ? <p className="mt-3 text-base leading-7 text-white">{takeHomeSentence}</p> : null}
        <h2 id={HEADING_ID} tabIndex={-1} className="mt-4 text-4xl font-extrabold tracking-tight text-balance text-yellow outline-none sm:text-5xl">
          {sentence}
        </h2>
        <p className="mt-3 text-base leading-7 text-white">{detail}</p>
        {growthSentence ? <p className="mt-3 text-base leading-7 text-white">{growthSentence}</p> : null}
        {notice ? <p className="mt-3 text-sm leading-6 text-muted">{notice}</p> : null}
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="glass p-5">
          <dt className="text-sm text-muted">Nest egg needed</dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{formatMoney(result.nestEggNeeded)}</dd>
          <p className="mt-2 text-sm leading-5 text-muted">Cash required when you retire, after CPF LIFE, to last until the planning age.</p>
        </div>
        <div className={`p-5 ${surplus ? "glass glass-surplus" : "glass glass-gap"}`}>
          <dt className="flex items-center gap-2 text-sm text-muted">
            {surplus ? <PlusIcon /> : <MinusIcon />}
            {surplus ? "Surplus" : "Gap"}
          </dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{gap}</dd>
          <p className="mt-2 text-sm leading-5 text-muted">
            Projected cash at retirement is {formatMoney(result.projectedCashAtRetirement)}. The {surplus ? "surplus" : "gap"} is that amount minus the nest egg.
          </p>
        </div>
        <div className="glass p-5">
          <dt className="flex flex-wrap items-center gap-2 text-sm text-muted">
            CPF LIFE payout
            {input.includeCpf ? (
              <EstimateTag
                id="cpf-life-payout"
                explanation={result.estimates.find((note) => note.id === "cpf-life-payout")?.explanation ?? "Estimated payout."}
                onOpen={() => onOpenEstimate("CPF LIFE payout")}
              />
            ) : null}
          </dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
            {input.includeCpf ? `${formatMoney(result.cpfLifeMonthly)} / mo` : "Not included"}
          </dd>
          {input.includeCpf ? (
            <p className="mt-2 text-sm leading-5 text-white">
              in {payoutYear} dollars, about {formatMoney(payoutToday)} in today’s money
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-5 text-muted">
            {input.includeCpf
              ? "A flat monthly amount from the payout age. It does not rise with inflation."
              : "CPF balances are left out, so no payout is counted."}
          </p>
        </div>
        <div className="glass p-5">
          <dt className="text-sm text-muted">{savingNow.label}</dt>
          <dd className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${savingNow.short ? "text-yellow" : "text-white"}`}>
            {formatMoney(savingNow.displayAmount)}
          </dd>
          <p className="mt-2 text-sm leading-5 text-muted">{savingNow.explanation}</p>
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
            <button type="button" className="pill pill-ghost text-left" onClick={() => { track("Gap Suggestion Applied", { type: "extra-saving" }); const currentExtra = parseDecimal(form.extraMonthlySaving) ?? input.extraMonthlySaving; onApply({ extraMonthlySaving: String(Math.ceil(currentExtra + result.extraMonthlySaving!)) }, "suggestion"); }}>
              Save {formatMoney(result.extraMonthlySaving)} more each month
            </button>
          ) : null}
          {result.spendingCutNow !== null && Math.round(result.spendingCutNow) >= 1 ? (
            <button type="button" className="pill pill-ghost text-left" onClick={() => { track("Gap Suggestion Applied", { type: "spend-less-now" }); onApply({ monthlyExpensesNow: String(Math.max(0, Math.floor(input.monthlyExpensesNow - result.spendingCutNow!))) }, "suggestion"); }}>
              Spend {formatMoney(result.spendingCutNow)} less each month now
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
        <p className="mt-1 text-sm leading-5 text-muted">The solid line is the working years. The dashed line is retirement. Cash only. A yellow marker shows Ordinary Account savings moved into cash.</p>
        <BalanceChart
          series={result.series}
          retirementAge={input.retirementAge}
          lifeExpectancy={input.lifeExpectancy}
          moneyRunsOutAge={result.moneyRunsOutAge}
          currency="SGD"
          annualInflation={input.annualInflation}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-bold">Assumptions you should read</h3>
        {result.estimates.map((note) => (
          <div key={note.id} className="flex flex-col items-start gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-medium text-white">{note.title}</p>
              <EstimateTag id={`${note.id}-assumption`} explanation={note.explanation} onOpen={() => onOpenEstimate(note.title)} />
            </div>
          </div>
        ))}
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          <li>Contributions use the published citizen rates for each calendar year, on wages above {formatMoney(CPF_WAGE.fullRateAbove.value)}, capped at the {formatMoney(CPF_WAGE.ordinaryCeiling.value)} ordinary wage ceiling from {PLANNING_YEAR}. Senior-worker rates use the published 2027 table from January 2027, then stay on that table. Additional wages are not modelled. The annual wage ceiling is {formatMoney(CPF_WAGE.annualCeiling.value)}.</li>
          <li>The Full Retirement Sum for the year you turn 55, not a voluntary top-up to the Enhanced Retirement Sum, is set aside at 55. The Enhanced Retirement Sum is the {ENHANCED_RETIREMENT_SUM.year} top-up limit of {formatMoney(ENHANCED_RETIREMENT_SUM.value)}. It is not four times an earlier cohort’s Basic Retirement Sum.</li>
          <li>Interest is calculated on each month’s balance and added at the end of December. It is not monthly compounding.</li>
          <li>MediSave is not used for living costs. Ordinary Account savings, including interest already earned that year, move into spendable cash at retirement, or at 55 if you retire earlier. If an OA loan is still running, the leftover moves the month after the loan ends. Later Ordinary Account interest goes to cash, and the Retirement Account stays at zero once CPF LIFE starts.</li>
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

function YesNoChoice({
  value,
  yesId,
  noId,
  labelledBy,
  hintId,
  controlsId,
  onActivate,
}: {
  value: OptionalAnswer;
  yesId: string;
  noId: string;
  labelledBy: string;
  hintId?: string;
  controlsId: string;
  onActivate: (button: "yes" | "no", activation: string) => void;
}) {
  const onKeyDown = (button: "yes" | "no", event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onActivate(button, event.key);
  };

  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={hintId} className="flex flex-wrap gap-3">
      <button
        type="button"
        id={yesId}
        className={`choice-pill pill ${value === "yes" ? "pill-shout" : "pill-ghost"}`}
        aria-expanded={value === "yes"}
        aria-controls={controlsId}
        aria-pressed={value === "yes"}
        onClick={() => onActivate("yes", "click")}
        onKeyDown={(event) => onKeyDown("yes", event)}
      >
        Yes
      </button>
      <button
        type="button"
        id={noId}
        className={`choice-pill pill ${value === "no" ? "pill-shout" : "pill-ghost"}`}
        aria-pressed={value === "no"}
        onClick={() => onActivate("no", "click")}
        onKeyDown={(event) => onKeyDown("no", event)}
      >
        No
      </button>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden="true">
      <path fill="currentColor" d="M8.2 13.6 4.7 10.1l1.2-1.2 2.3 2.3 5.9-5.9 1.2 1.2-7.1 7.1Z" />
    </svg>
  );
}

function ShortfallIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-yellow" aria-hidden="true">
      <path fill="currentColor" d="M10 2.2 18 16.4H2L10 2.2Zm0 4.2-.7 4.6h1.4L10 6.4Zm0 6.2a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-yellow" aria-hidden="true">
      <path fill="currentColor" d="M9 4h2v5h5v2h-5v5H9v-5H4V9h5V4Z" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden="true">
      <path fill="currentColor" d="M4 9h12v2H4V9Z" />
    </svg>
  );
}

function CautionIcon() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 size-4 shrink-0 text-yellow" aria-hidden="true">
      <path fill="currentColor" d="M10 2.2 18 16.4H2L10 2.2Zm0 4.2-.7 4.6h1.4L10 6.4Zm0 6.2a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z" />
    </svg>
  );
}
