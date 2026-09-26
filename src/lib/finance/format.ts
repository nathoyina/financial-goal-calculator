export const CURRENCIES = [
  { code: "SGD", label: "Singapore dollar", prefix: "S$" },
  { code: "USD", label: "US dollar", prefix: "US$" },
  { code: "EUR", label: "Euro", prefix: "€" },
  { code: "GBP", label: "British pound", prefix: "£" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

const grouped = new Intl.NumberFormat("en-SG", {
  maximumFractionDigits: 0,
});

export function currencyPrefix(currency: CurrencyCode): string {
  return CURRENCIES.find((item) => item.code === currency)?.prefix ?? "S$";
}

export function formatMoney(amount: number, currency: CurrencyCode = "SGD"): string {
  if (!Number.isFinite(amount)) return "—";
  const sign = amount < 0 ? "−" : "";
  return `${sign}${currencyPrefix(currency)}${grouped.format(Math.abs(amount))}`;
}

function trimFixed(value: number, digits: number): string {
  return value.toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export function formatCompactMoney(amount: number, currency: CurrencyCode = "SGD"): string {
  if (!Number.isFinite(amount)) return "—";
  const sign = amount < 0 ? "−" : "";
  const prefix = currencyPrefix(currency);
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    return `${sign}${prefix}${trimFixed(millions, millions >= 10 ? 1 : 2)}m`;
  }
  if (abs >= 10_000) {
    const thousands = abs / 1_000;
    return `${sign}${prefix}${trimFixed(thousands, thousands >= 100 ? 0 : 1)}k`;
  }
  return formatMoney(amount, currency);
}

export function formatPercent(rate: number): string {
  if (!Number.isFinite(rate)) return "—";
  const text = new Intl.NumberFormat("en-SG", {
    maximumFractionDigits: 2,
  }).format(rate * 100);
  return `${text}%`;
}

/** A span such as "6 years" or "5 years 9 months". */
export function formatDuration(years: number): string {
  if (!Number.isFinite(years)) return "—";
  const absolute = Math.abs(years);
  let wholeYears = Math.floor(absolute + 1e-8);
  let months = Math.round((absolute - wholeYears) * 12);
  if (months === 12) {
    wholeYears += 1;
    months = 0;
  }
  const parts: string[] = [];
  if (wholeYears > 0) {
    parts.push(`${wholeYears} ${wholeYears === 1 ? "year" : "years"}`);
  }
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? "month" : "months"}`);
  }
  return parts.join(" ") || "0 months";
}

/** Whole years, or years and months when the age is not a whole year. */
export function formatAge(age: number): string {
  if (!Number.isFinite(age)) return "—";
  const sign = age < 0 ? "−" : "";
  const absolute = Math.abs(age);
  let years = Math.floor(absolute + 1e-8);
  let months = Math.round((absolute - years) * 12);
  if (months === 12) {
    years += 1;
    months = 0;
  }
  if (months <= 0) return `${sign}${years}`;
  const monthLabel = months === 1 ? "month" : "months";
  return `${sign}${years} years ${months} ${monthLabel}`;
}
