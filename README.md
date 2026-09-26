# financial-goal-calculator

A retirement planner for someone working in Singapore. You enter your age, income, spending, and optional CPF balances, a home loan, and education costs. It says whether the retirement age you chose works, the nest egg that age needs, the cash you are on track to have, the gap, and what would close a shortfall.

Retirement is the only goal in v1. The maths is a pure function. There is no account and no server: the calculation runs in the browser. Another savings goal, such as a house deposit or an emergency fund, can be added beside it later.

The currency is Singapore dollars. This is an estimate for planning, not financial advice.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm test` | Run the finance unit tests |
| `npm run lint` | Run ESLint |
| `npm run build` | Production build |

The app is a Next.js App Router project with TypeScript and Tailwind, so it can deploy on Vercel as a static page. No environment variables are required.

## What you enter

The form is five steps, then a verdict.

| Step | What it collects |
| --- | --- |
| Retirement age | Current age, the age you want to stop work, and the age the plan should last until. Retirement can be 40 or 70. It only has to be after today and before the planning age. |
| Income and expenses | Gross monthly income, optional income growth, monthly expenses now, retirement spending in today’s prices, cash savings, extra monthly saving, expected return, and inflation. Saving capacity is income minus employee CPF, expenses, and a cash loan, plus any extra you add. |
| Housing loan | Optional. Outstanding balance, your interest rate, years left, and whether you pay from the Ordinary Account or from cash. Leave the instalment blank to use the monthly-rest formula, or type the instalment you actually pay. |
| CPF | Optional. Ordinary Account, Special Account, Retirement Account, and MediSave, plus the age you want CPF LIFE to start (65 to 70). |
| Education | Optional. One or more children. Local, overseas, or other is a label only. You type the yearly cost. |

The example plan is a 35-year-old retiring at 65, planning to age 90, earning S$7,000 a month, spending S$4,000 now and S$3,500 in retirement (today’s prices), with S$40,000 in cash and starter CPF balances. Return 5%, inflation 2.5%, income growth 2%.

## What you get

The verdict is one sentence: you can retire at that age, or you cannot.

- **Nest egg needed.** Cash required on the day you retire so that spending, after CPF LIFE, lasts until the planning age.
- **Projected cash.** Cash savings on that day, including Ordinary Account money moved into cash when that happens at retirement.
- **Gap.** Projected cash minus the nest egg. Positive is a surplus. Negative is a shortfall.
- **CPF LIFE payout.** A flat monthly estimate from the payout age, when CPF is included.
- **Left to save today.** This month’s income minus employee CPF, spending, and a cash loan instalment, plus any extra saving.
- **If the plan fails.** The earliest later age that works, the extra monthly saving that closes the gap, or the retirement spending cut that does. Also the age cash runs out.
- **Chart.** Cash balance through the working years and retirement.

Any figure that depends on an assumption beyond a published table is tagged **Estimate**. The verdict says so in words when the result uses one.

## Formulas

### Cash

Let \(r\) be the annual effective return and \(f\) annual inflation. The monthly return is

\[
i = (1+r)^{1/12} - 1
\]

While you are working, cash grows, then this month’s net is applied at month end. Net cash is

\[
\text{wage} + \text{CPF LIFE already paying} - \text{employee CPF} - \text{expenses}\times(1+f)^{m/12} - \text{education} - \text{cash loan} - \text{OA shortfall} + \text{extra saving}
\]

Expenses rise with inflation. Income steps up once a year by the growth rate you enter. If a month would take cash below zero, savings are exhausted at that age.

In retirement the wage stops. The monthly need, in future dollars, is

\[
\text{retirement spending}\times(1+f)^{m/12} - \text{CPF LIFE} + \text{education} + \text{cash loan} + \text{OA shortfall}
\]

CPF LIFE is a level dollar amount. It does not rise with inflation. The need is withdrawn at the start of the month, then the remainder grows by \(i\). A negative need means income covered spending and the extra stays invested.

The nest egg is that retirement need, solved backwards from zero at the planning age:

\[
E_M = 0 \qquad E_m = \frac{E_{m+1}}{1+i} + w_m
\]

The gap is projected cash at retirement minus \(E_0\). If \(E_0\) would be negative because income exceeds spending, it is shown as zero.

### Home loan

You enter the rate. The plan does not invent an accrued-interest rate on CPF used for housing. With monthly rest, balance \(P\), monthly rate \(j = \text{annual}/12\), and \(n\) months left:

\[
\text{instalment} = \frac{P j}{1 - (1+j)^{-n}}
\]

At a zero rate the instalment is \(P / n\). A typed instalment replaces the formula. Payments stop when the balance is gone. Cash payments reduce what you can save. Ordinary Account payments reduce that account, and any month the account cannot cover is paid from cash.

### Education

Each study year costs the yearly amount you enter, inflated from today, and is withdrawn from cash at the start of that year. One year is a lump sum. Several years are a course. Years that would already have started are skipped. The local or overseas label does not fill in a fee. You type the cost.

### CPF

Checked against cpf.gov.sg on 26 September 2026. The uploaded reference file was not in this workspace, so the figures below were taken from those pages and live in `src/lib/cpf/constants.ts`. Nothing in the components hardcodes a rate.

Interest is calculated on each month’s balance and credited once a year. It is not monthly compounding.

| Item | Figure | Source |
| --- | --- | --- |
| Ordinary Account floor | 2.5% (1 Jul–30 Sep 2026) | [CPF interest, Q3 2026](https://www.cpf.gov.sg/member/infohub/news/news-releases/cpf-interest-rates-from-1-july-to-30-september-2026) |
| Special, MediSave, and Retirement Account floor | 4% through 31 Dec 2026 | [4% floor extension](https://www.cpf.gov.sg/member/infohub/news/news-releases/government-extends-4-per-cent-interest-rate-floor-on-special-medisave-and-retirement-account-monies-until-31-december-2026) |
| Extra interest below 55 | 1% on the first S$60,000 combined, OA capped at S$20,000. OA’s extra interest is credited to the Special Account. | Same Q3 2026 release |
| Extra interest from 55 | 2% on the first S$30,000 (OA cap S$20,000) and 1% on the next S$30,000. OA’s extra interest goes to the Retirement Account. | Same Q3 2026 release |
| Ordinary wage ceiling | S$8,000 from 1 Jan 2026. Full rates apply above S$750. | [How much CPF to pay](https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay) and the [Jan 2026 contribution PDF](https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFcontributionratesfrom1Jan2026.pdf) |
| Citizen / 3rd-year SPR rates, wages above S$750 | ≤55: 17% employer / 20% employee. >55–60: 16 / 18. >60–65: 12.5 / 12.5. >65–70: 9 / 7.5. >70: 7.5 / 5. Total rounded to the nearest dollar. Employee share floored. | Same contribution PDF. The 2027 senior-worker increase is not applied. |
| Allocation | MediSave first, then Special or Retirement Account, Ordinary Account receives the rest. Ratios from the [Jan 2026 allocation PDF](https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFAllocationRatesfromJanuary2026.pdf). | |
| Basic Healthcare Sum | S$79,000 in 2026. Excess MediSave flows to the Special Account before 55, and to the Retirement Account or Ordinary Account from 55. | [BHS for 2026](https://www.cpf.gov.sg/member/infohub/news/news-releases/cpf-interest-rates-from-1-january-to-31-march-2026-and-basic-healthcare-sum-for-2026) |
| Retirement sums | 2025 BRS S$106,500. 2026 BRS S$110,200. 2027 BRS S$114,100. Full Retirement Sum is 2× BRS. From 2025 the Enhanced Retirement Sum is 4× BRS. | [How the retirement sum affects payouts](https://www.cpf.gov.sg/member/infohub/educational-resources/how-the-cpf-retirement-sum-affects-your-payouts) and [What is the CPF retirement sum](https://www.cpf.gov.sg/member/infohub/educational-resources/what-is-the-cpf-retirement-sum) |

At 55 the Special Account closes. It fills the Retirement Account up to the Full Retirement Sum, and anything above that returns to the Ordinary Account. The Ordinary Account then tops the Retirement Account up to the Full Retirement Sum. New Retirement Account contributions above the Full Retirement Sum spill to the Ordinary Account. Interest is allowed to grow the Retirement Account past that sum.

The plan sets aside the Full Retirement Sum, not a voluntary top-up to the Enhanced Retirement Sum.

CPF LIFE uses the Standard plan only. Payouts are interpolated from CPF’s 2026 illustrative anchors for a male member (Retirement Account at 65, monthly payout): BRS S$170,200 → S$950, FRS S$330,100 → S$1,780, ERS S$650,100 → S$3,440. Below or above that range, the payout scales from the nearest point. The Retirement Account is set to zero when payouts start. Deferring past 65 uses 7% a year up to age 70. CPF describes that increase as “up to 7%”, so the plan labels it an estimate. The payout is based on the age-65 Retirement Account, so later growth is not counted twice. The Escalating plan is not modelled, because a start discount was not taken from a page we could cite.

Cohorts turning 55 after 2027 reuse the 2027 retirement sums and are labelled estimates. Interest rates are the 2026 floors, held flat for the whole projection, and labelled estimates. MediSave is not spent on living costs.

Ordinary Account savings move into spendable cash at retirement, or at 55 if you retire earlier, unless an Ordinary Account loan still has payments after retirement. In that case the account stays put to keep paying the loan.

CPF LIFE that starts before retirement, which is what happens if you keep working past the payout age, is added to cash each month. There is no upper limit on the retirement age itself. A member who is already 65 or older has no age-65 snapshot in this plan, so the payout is estimated from the Retirement Account they enter, and the “up to 7%” deferral is applied only for years still ahead. The CPF monthly payout estimator is the logged-in tool for a personal quote. CPF points members under 55 to the Retirement Payout Planner instead. This app projects the balance forward and labels the result an estimate. MoneyOwl’s retirement planner asks the same kinds of questions, salary and saving, cash, and CPF balances, then shows whether the plan works. This screen uses its own layout and its own maths.

### Feasibility

You can retire when cash never hits zero before the planning age. If it does, the plan searches:

- extra monthly saving, by binary search from S$0 to S$100,000 on top of what you already entered
- a lower retirement spending level, in today’s prices
- the earliest whole age, after today and before the planning age, at which the same plan lasts

A search that still fails at the edge returns no suggestion for that lever.

### Worked cash check

The older cash-only module, `calculateRetirement` in `src/lib/finance/retirement.ts`, still covers a hand-checked case. Zero return, zero inflation, age 40, retirement at 50, planning age 60. Savings S$10,000, contribution S$500 a month, spending S$2,000, other income S$500.

- Projected savings: \(10{,}000 + 500 \times 120 = 70{,}000\)
- Nest egg: \(1{,}500 \times 120 = 180{,}000\)
- Extra monthly saving: \(110{,}000 / 120 \approx 916.67\)
- Money runs out at about age 53.89

That module still allows an already-retired drawdown, for the edge-case tests. The planner form does not: retirement age has to be after your current age.

## SGFinDex

This app cannot pull CPF balances. SGFinDex is reached through participating banks and government services with Singpass consent. MyInfo does not expose CPF balances to an ordinary third-party web app, and there is no public API an independent calculator can call. Enter the four balances yourself. They stay in the browser.

A real integration would need a government-approved business app on the Singpass Developer Portal, justified data scopes, and production approval. It is not something a static client-side page can do.

## Analytics

`track(event, props)` in `src/lib/analytics/track.ts` records events in memory only. No SDK is installed. Amplitude can subscribe to the same helper later. The events are Landing Viewed, Calculator Started, Step Viewed, Step Completed, Step Skipped, Input Validation Error, Verdict Viewed, Gap Suggestion Applied, Inputs Adjusted After Verdict, and Estimate Info Opened. Step names are retirement age, income & expenses, housing loan, CPF, and education. Verdict properties are the outcome (on track or shortfall), a gap band, a retirement-age band, and flags for a housing loan, children, and whether the result relies on an estimate. Exact salaries, balances, and loan amounts are not recorded.

## Assumptions

- Return, inflation, and income growth are constant. A poor sequence of returns early in retirement can empty cash sooner than the chart shows.
- The nest egg is not a bequest. It is built to finish near zero at the planning age.
- Taxes, fees, and investment products are not modelled.
- CPF rules change. Rates after the cited period are an estimate, including the 4% floor after 31 December 2026.
- Housing accrued interest and the CPF LIFE Escalating plan are left out on purpose. Those rates were not taken from a source we could cite, so they are not invented here.

## Project layout

```
src/app/                  App Router page and styles
src/components/           Wizard, chart, fields
src/lib/finance/          Cash plan, loan, education, formatting
src/lib/cpf/              Cited CPF constants and the projection
src/lib/analytics/        No-op event tracker
src/lib/goals/            Goal registry (retirement only)
```

`calculatePlan` in `src/lib/finance/plan.ts` is what the wizard runs.

## Adding another goal

1. Extend `GoalKind` in `src/lib/goals/types.ts`.
2. Add a pure calculator next to the retirement module. Keep it free of React.
3. Register it in `src/lib/goals/registry.ts`.
4. Add a screen that calls that calculator. Leave `calculatePlan` and `calculateRetirement` alone.

A house deposit or an emergency fund would be a lump sum on a date, so it can reuse `futureValue` from the cash module and skip the drawdown.
