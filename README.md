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

Checked against cpf.gov.sg on 26 September 2026, using the team’s CPF reference from that day and the pages linked below. Every figure lives in `src/lib/cpf/constants.ts` with its year and source URL. Components read that file. They do not hardcode a rate.

Interest is calculated on each month’s balance and credited at the end of December, which is how [CPF’s Home Purchase Planner](https://www.cpf.gov.sg/member/tools-and-services/planners/home-purchase) projects it. It is not monthly compounding.

| Item | Figure | Source |
| --- | --- | --- |
| Ordinary Account floor | 2.5% for 1 Oct–31 Dec 2026 | [4% floor extended to 31 Dec 2027](https://www.cpf.gov.sg/member/infohub/news/news-releases/government-extends-4-per-cent-interest-rate-floor-on-special-medisave-and-retirement-account-monies-until-31-december-2027) |
| Special, MediSave, and Retirement Account floor | 4%, committed through 31 Dec 2027 | Same 22 September 2026 release |
| HDB concessionary loan | 2.6% for the same quarter. The loan field starts here. Replace it with your own rate. | Same release |
| Extra interest below 55 | 1% on the first S$60,000 combined, OA capped at S$20,000. OA’s extra interest is credited to the Special Account. | Same release, and [earning attractive interest](https://www.cpf.gov.sg/member/growing-your-savings/earning-higher-returns/earning-attractive-interest) |
| Extra interest from 55 | 2% on the first S$30,000 (OA cap S$20,000) and 1% on the next S$30,000. OA’s extra interest goes to the Retirement Account. | Same pages |
| Ordinary wage ceiling | S$8,000 in 2026 and 2027 (S$7,400 in 2025). Full rates apply above S$750. Annual ceiling S$102,000. | [Jan 2026 contribution PDF](https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFcontributionratesfrom1Jan2026.pdf) |
| Citizen / 3rd-year SPR rates, 2026, wages above S$750 | ≤55: 17% employer / 20% employee. >55–60: 16 / 18. >60–65: 12.5 / 12.5. >65–70: 9 / 7.5. >70: 7.5 / 5. Total rounded to the nearest dollar. Employee share floored. | Same 2026 PDF |
| Citizen / 3rd-year SPR rates, from January 2027 | ≤55 stays 17 / 20. >55–60 becomes 16.5 / 19. >60–65 becomes 13 / 13. Above 65 is unchanged. Later years keep this 2027 table. | [Jan 2027 contribution PDF](https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/jan2027cpfcontributionrates.pdf) and [new contribution rates](https://www.cpf.gov.sg/employer/infohub/news/cpf-related-announcements/new-contribution-rates) |
| Allocation | MediSave first, then Special or Retirement Account, Ordinary Account receives the rest. 2026 ratios from the [Jan 2026 allocation PDF](https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFAllocationRatesfromJanuary2026.pdf). From 2027, ages above 55 to 65 use the [Jan 2027 allocation PDF](https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/jan2027cpfallocationrates.pdf): above 55–60 is OA 33.82% / RA 36.61% / MA 29.57%, and above 60–65 is OA 13.47% / RA 46.15% / MA 40.38%. | |
| Basic Healthcare Sum | S$66,000 (2022), S$68,500 (2023), S$71,500 (2024), S$75,500 (2025), S$79,000 (2026). Applied for that calendar year under 65, and fixed for life in the year the member turns 65. Years after 2026 are not published, so the plan does not spill MediSave at the 2026 cap in those years. | The yearly BHS news releases, including [2026](https://www.cpf.gov.sg/member/infohub/news/news-releases/cpf-interest-rates-from-1-january-to-31-march-2026-and-basic-healthcare-sum-for-2026) |
| Retirement sums | Basic and Full Retirement Sums for the year the member turned 55. Official rows: 2017–2020 from CPF’s table (2017 Basic S$83,000), 2022–2024 from the MOM Budget 2022 factsheet, and 2025–2027 from CPF (2027 Basic S$114,100). Full Retirement Sum is 2× the Basic sum. 2021 (Basic S$93,000) is news coverage only and is labelled an estimate. A year before 2017 uses the 2017 figures and is labelled an estimate. The Enhanced Retirement Sum is the 2026 top-up limit of S$440,800, not a multiple of an older cohort’s Basic sum. | [CPF retirement sums PDF](https://www.cpf.gov.sg/content/dam/web/member/general-documents/Retirement%20Sums.pdf), [MOM Budget 2022 factsheet](https://www.mom.gov.sg/-/media/mom/documents/budget2022/factsheet-on-basic-retirement-sums-for-cpf-members-reaching-age-55-from-2023-to-2027.pdf/1000), and [What is the CPF retirement sum](https://www.cpf.gov.sg/member/infohub/educational-resources/what-is-the-cpf-retirement-sum) |

At 55 the Special Account closes. It fills the Retirement Account up to the Full Retirement Sum, and anything above that returns to the Ordinary Account. The Ordinary Account then tops the Retirement Account up to the Full Retirement Sum. New Retirement Account contributions above the Full Retirement Sum spill to the Ordinary Account. Interest is allowed to grow the Retirement Account past that sum. If the Full Retirement Sum is not met, CPF allows a withdrawal of up to S$5,000. This plan leaves that amount in the Retirement Account so it can support CPF LIFE. A property pledge that can cover up to half the Full Retirement Sum is not modelled.

The plan sets aside the Full Retirement Sum, not a voluntary top-up to the Enhanced Retirement Sum.

CPF LIFE uses the Standard plan only. Payouts are interpolated from CPF’s 2026 illustrative anchors for a male member (Retirement Account at 65, monthly payout): BRS S$170,200 → S$950, FRS S$330,100 → S$1,780, ERS S$650,100 → S$3,440. CPF calculates those with 6% a year. Below or above that range, the payout scales from the nearest point. The Retirement Account is set to zero when payouts start. The payout is based on the age-65 Retirement Account, so later growth is not counted twice.

Official payout ranges exist for the 2025 cohort only. 2026 cohort ranges were not on cpf.gov.sg on 26 September 2026, so the screen marks them as an estimate and uses the illustration above.

Deferring past 65 uses up to 7% a year, up to 35% at age 70. That 35% is 7% times five years, not compound growth. The plan uses the ceiling and labels it an estimate. CPF’s own illustration for the 2026 Full Retirement Sum starting at 70 is S$2,380 a month, which is lower than the ceiling. The Escalating plan’s starting discount was not published, so the plan does not model it and shows that as an estimate. Standard payouts stay level in dollar terms.

Cohorts turning 55 after 2027 are an assumption: the 2027 Basic Retirement Sum grows by 3.5% a year, about the 2025–2027 pace, and is rounded to the nearest S$100. Full Retirement Sum stays 2× that grown Basic sum. The Enhanced Retirement Sum stays the 2026 top-up limit of S$440,800, because a later limit is not invented. The screen labels the post-2027 Basic and Full sums as an assumption. A member who turned 55 before 2017 uses the 2017 sums, labelled an estimate. The 2021 sums are labelled an estimate because they come from news coverage. Interest rates are the late-2026 floors. The 4% floor is committed through 31 December 2027. Both rates are then held flat and labelled estimates. MediSave is not spent on living costs.

Additional wages are not modelled. The annual ceiling of S$102,000 would cap ordinary wages plus bonuses. This plan only caps the monthly ordinary wage. Selling a home bought with CPF requires a refund of principal plus accrued interest. That interest rate was not confirmed, so the plan does not charge it and shows an estimate tag. The loan rate you type is used for the monthly-rest instalment only.

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

`track(event, props)` in `src/lib/analytics/track.ts` records events in memory only. No SDK is installed. Amplitude can subscribe to the same helper later. The events are Landing Viewed, Calculator Started, Step Viewed, Step Completed, Step Skipped, Input Validation Error, Verdict Viewed, Gap Suggestion Applied, Inputs Adjusted After Verdict, and Estimate Info Opened. Step names are retirement age, income & expenses, housing loan, CPF, and education. Verdict Viewed includes `relies_on_estimate`, `is_first_verdict` (true only for the first verdict in the session), the outcome, a gap band, a retirement-age band, and flags for a housing loan and children. It is recorded again when a later edit changes the gap band or the retirement-age band. Inputs Adjusted After Verdict fires once for each verdict the person has seen, on the first edit after that verdict, and not on every keystroke. Estimate Info Opened includes the figure name only, such as “Retirement sum” or “Escalating plan”. Exact salaries, balances, and loan amounts are not recorded.

## Assumptions

- Return, inflation, and income growth are constant. A poor sequence of returns early in retirement can empty cash sooner than the chart shows.
- The nest egg is not a bequest. It is built to finish near zero at the planning age.
- Taxes, fees, and investment products are not modelled.
- CPF rules change. Rates after the cited period are an estimate, including the 4% floor after 31 December 2027 and retirement sums after the 2027 cohort.
- The 2026 CPF LIFE payout ranges, the Escalating plan’s starting discount, and the accrued-interest rate on housing withdrawals were not verified on 26 September 2026. The screen marks each as an estimate. The last two are not applied.

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
