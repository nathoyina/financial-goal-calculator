import { describe, expect, it } from "vitest";
import { formatAge, formatCompactMoney, formatDuration, formatMoney, formatPercent } from "./format";

describe("formatters", () => {
  it("formats SGD with an explicit S$ prefix", () => {
    expect(formatMoney(1234567, "SGD")).toBe("S$1,234,567");
    expect(formatMoney(-250, "SGD")).toBe("−S$250");
  });

  it("compacts chart labels", () => {
    expect(formatCompactMoney(1_250_000, "SGD")).toBe("S$1.25m");
    expect(formatCompactMoney(12_400_000, "SGD")).toBe("S$12.4m");
    expect(formatCompactMoney(84_600, "SGD")).toBe("S$84.6k");
  });

  it("formats percents and ages in plain language", () => {
    expect(formatPercent(0.025)).toBe("2.5%");
    expect(formatPercent(0.05)).toBe("5%");
    expect(formatAge(65)).toBe("65");
    expect(formatAge(43 + 11 / 12)).toBe("43 years 11 months");
    expect(formatDuration(6)).toBe("6 years");
    expect(formatDuration(1 / 12)).toBe("1 month");
    expect(formatDuration(5 + 9 / 12)).toBe("5 years 9 months");
  });
});
