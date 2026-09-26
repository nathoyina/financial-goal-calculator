# University cost presets for financial-goal-calculator (checked 26 Sep 2026)
All figures are per year, in today's prices. The app inflates them to the start year.

## Local university (Singapore citizen, MOE-subsidised)
| Item | Figure | Source |
|---|---|---|
| Tuition, most NUS/NTU programmes | S$8,300 | NUS AY2026/27 fee table https://www.nus.edu.sg/registrar/docs/default-source/administrative-policies-procedures/ugtuitioncurrent.pdf ; NTU 2026 intake https://www.ntu.edu.sg/admissions/undergraduate/financial-matters/tuition-fees/accepted-programme-offer-in-2026 |
| Tuition, business at NUS/NTU (reference only) | S$9,500 to S$9,700 | same pages |
| Tuition, SMU most degrees (reference only) | S$11,550 | https://admissions.smu.edu.sg/financial-matters/tuition-fees-grant |
| Living costs, excluding accommodation | S$6,000 | NUS living costs https://www.nus.edu.sg/oam/financial-aid/living-costs |
| On-campus hostel (optional, not in preset) | S$4,000 to S$10,290 | same NUS page |
**Preset: S$14,300 a year for 4 years** (S$8,300 tuition + S$6,000 living, child living at home).
Notes: medicine, dentistry and law cost much more. Fees are fixed per intake cohort; later cohorts' fees are not published.

## Overseas university (international student)
Exchange rates: SingStat/MAS end-July 2026, SGD per unit: GBP 1.7269, AUD 0.9021, USD 1.2838 (data.gov.sg dataset d_cdd73fd4341b345fa4307e44d6f82175).

| Country | Tuition | Living | Total per year | Years | Status |
|---|---|---|---|---|---|
| UK | GBP 22,000 (UCAS average for international undergraduates; range GBP 11,400 to 38,000) | GBP 10,539 (UK visa minimum, GBP 1,171 x 9 months outside London; London GBP 1,529 x 9) | GBP 32,539, about **S$56,200** | 3 | Official sources, but the living figure is a visa minimum |
| Australia | A$45,000 **ASSUMPTION**. No official average; 2026 examples: RMIT A$36,000 to 50,000, Swinburne A$34,200 to 47,320 | A$29,710 (student visa living-cost requirement, LIN 19/198) | A$74,710, about **S$67,400** | 3 | Tuition is an assumption |
| US (public, out-of-state) | USD 31,880 | USD 13,900 room and board | USD 45,780, about **S$58,800** | 4 | College Board Trends in College Pricing 2025-26 (sticker prices) |
| US (private nonprofit, reference) | USD 45,000 | USD 15,920 | USD 60,920, about S$78,200 | 4 | same |

Sources (the UCAS, gov.uk and local URLs were fetched directly; the LIN, RMIT, Swinburne and College Board links point to the right pages but should be re-opened before citing in the UI):
- UCAS https://www.ucas.com/international/international-students/financial-information-for-international-students/what-finance-options-are-available-if-i-want-to-study-in-the-uk
- UK visa money https://www.gov.uk/student-visa/money
- Australia LIN 19/198 https://www.legislation.gov.au/F2019L01366/latest/details
- RMIT https://www.rmit.edu.au/study-with-us/international-students/study/cost-of-studying-in-australia ; Swinburne https://www.swinburne.edu.au/courses/fees/fees-for-international-students/
- College Board https://research.collegeboard.org/trends/college-pricing/highlights

Caveats for the UI label: visa living figures are minimums; exchange rates move; excludes flights, insurance and books (UK/AU) and books/personal costs (US).
