"use client";

import { useId, useState } from "react";
import { formatAge, formatCompactMoney, formatMoney, type CurrencyCode } from "@/lib/finance/format";
import { displayedBalance, type DollarMode } from "@/lib/finance/guidance";
import type { BalancePoint } from "@/lib/finance/plan";

const VIEW_W = 720;
const VIEW_H = 340;
const PAD = { left: 92, right: 18, top: 22, bottom: 36 };

function axisMax(value: number): number {
  const padded = Math.max(value, 1) * 1.05;
  const rough = padded / 4;
  const exponent = Math.floor(Math.log10(rough));
  const magnitude = 10 ** exponent;
  const normalized = rough / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  const step = nice * magnitude;
  return Math.ceil(padded / step) * step;
}

function yearlyRows(series: BalancePoint[]): BalancePoint[] {
  const rows: BalancePoint[] = [];
  series.forEach((point, index) => {
    const whole = Math.abs(point.age - Math.round(point.age)) < 1e-6;
    const isLast = index === series.length - 1;
    const isSweep = (point.oaSweep ?? 0) > 0;
    if (!whole && !isLast && !isSweep) return;
    const previous = rows[rows.length - 1];
    if (previous && Math.abs(previous.age - point.age) < 1e-6) {
      rows[rows.length - 1] = point;
      return;
    }
    rows.push(point);
  });
  return rows;
}

function modeLabel(mode: DollarMode): string {
  return mode === "today" ? "Today's money" : "Future money";
}

export function BalanceChart({
  series,
  retirementAge,
  lifeExpectancy,
  moneyRunsOutAge,
  currency,
  annualInflation,
}: {
  series: BalancePoint[];
  retirementAge: number;
  lifeExpectancy: number;
  moneyRunsOutAge: number | null;
  currency: CurrencyCode;
  annualInflation: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<DollarMode>("today");
  const chartId = useId().replace(/:/g, "");
  if (series.length === 0) return null;

  const currentAge = series[0].age;
  const show = (balance: number, age: number) =>
    displayedBalance({ balance, age, currentAge, annualInflation, mode });
  const dollars = modeLabel(mode);

  const minAge = currentAge;
  const maxAge = Math.max(lifeExpectancy, series[series.length - 1].age);
  const yMax = axisMax(Math.max(...series.map((point) => show(point.balance, point.age)), 0));
  const plotW = VIEW_W - PAD.left - PAD.right;
  const plotH = VIEW_H - PAD.top - PAD.bottom;

  const xOf = (age: number) => PAD.left + ((age - minAge) / Math.max(maxAge - minAge, 1 / 12)) * plotW;
  const yOf = (balance: number) => PAD.top + (1 - Math.min(balance, yMax) / yMax) * plotH;

  const toXY = (point: BalancePoint) => ({ x: xOf(point.age), y: yOf(show(point.balance, point.age)) });
  const accumulation = series.filter((point) => point.phase === "accumulation");
  const drawdown = series.filter((point) => point.phase === "drawdown");
  const bridge = accumulation.at(-1);
  const drawdownLine = bridge ? [bridge, ...drawdown] : drawdown;
  const sweep = series.find((point) => (point.oaSweep ?? 0) > 0) ?? null;
  const sweepAmount = sweep?.oaSweep ?? 0;
  const sweepShown = sweep ? show(sweepAmount, sweep.age) : 0;
  const sweepText = sweep
    ? `${formatMoney(sweepShown, currency)} moved from CPF Ordinary Account, in ${dollars}`
    : null;

  const pathOf = (points: BalancePoint[]) =>
    points
      .map((point, index) => {
        const { x, y } = toXY(point);
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  const areaOf = (points: BalancePoint[]) => {
    if (points.length === 0) return "";
    const first = toXY(points[0]);
    const last = toXY(points[points.length - 1]);
    const baseline = yOf(0);
    return `${pathOf(points)} L${last.x.toFixed(1)} ${baseline.toFixed(1)} L${first.x.toFixed(1)} ${baseline.toFixed(1)} Z`;
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => yMax * fraction);
  const xTicks = [minAge, retirementAge, maxAge].filter((age, index, all) => {
    return age >= minAge - 1e-6 && age <= maxAge + 1e-6 && all.findIndex((other) => Math.abs(other - age) < 0.2) === index;
  });

  const hover = hoverIndex === null ? null : series[hoverIndex];
  const rows = yearlyRows(series);
  const axisName = modeLabel(mode);

  const move = (clientX: number, bounds: DOMRect) => {
    const viewX = ((clientX - bounds.left) / bounds.width) * VIEW_W;
    const age = minAge + ((viewX - PAD.left) / plotW) * (maxAge - minAge);
    let nearest = 0;
    let best = Infinity;
    series.forEach((point, index) => {
      const distance = Math.abs(point.age - age);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setHoverIndex(nearest);
  };

  return (
    <figure className="flex flex-col gap-3">
      <div role="group" aria-label="Choose how to show balances" className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`choice-pill pill ${mode === "today" ? "pill-shout" : "pill-ghost"}`}
          aria-pressed={mode === "today"}
          onClick={() => setMode("today")}
        >
          Today&apos;s money
        </button>
        <button
          type="button"
          className={`choice-pill pill ${mode === "future" ? "pill-shout" : "pill-ghost"}`}
          aria-pressed={mode === "future"}
          onClick={() => setMode("future")}
        >
          Future money
        </button>
      </div>
      <p id={`${chartId}-mode`} aria-live="polite" className="text-sm font-semibold text-yellow">
        Vertical axis: {dollars}
      </p>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="h-auto w-full"
        role="img"
        aria-labelledby={`${chartId}-title ${chartId}-desc ${chartId}-mode`}
        onPointerDown={(event) => move(event.clientX, event.currentTarget.getBoundingClientRect())}
        onPointerMove={(event) => move(event.clientX, event.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <title id={`${chartId}-title`}>{`Savings balance from age ${formatAge(minAge)} to ${formatAge(maxAge)}, in ${dollars}`}</title>
        <desc id={`${chartId}-desc`}>
          The solid line is the working years. The dashed line is retirement. Amounts are in {dollars}.
          {sweepText ? ` ${sweepText}.` : ""}
          {moneyRunsOutAge === null
            ? " The balance lasts through the planning age."
            : ` The balance reaches zero at age ${formatAge(moneyRunsOutAge)}.`}
        </desc>
        <text
          transform={`translate(16 ${PAD.top + plotH / 2}) rotate(-90)`}
          textAnchor="middle"
          fill="#FDE047"
          fontSize="13"
          fontWeight="700"
        >
          {axisName}
        </text>
        {yTicks.map((tick) => {
          const y = yOf(tick);
          return (
            <g key={tick}>
              <line x1={PAD.left} x2={VIEW_W - PAD.right} y1={y} y2={y} stroke="#3a3a3a" strokeWidth="1" />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="#d4d4d4" fontSize="12">
                {formatCompactMoney(tick, currency)}
              </text>
            </g>
          );
        })}
        {moneyRunsOutAge !== null ? (
          <rect
            x={xOf(moneyRunsOutAge)}
            y={PAD.top}
            width={Math.max(xOf(maxAge) - xOf(moneyRunsOutAge), 0)}
            height={plotH}
            fill="#3a2424"
          />
        ) : null}
        {retirementAge > minAge + 0.05 && retirementAge < maxAge - 0.05 ? (
          <line
            x1={xOf(retirementAge)}
            x2={xOf(retirementAge)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke="#a3a3a3"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
        ) : null}
        {accumulation.length > 0 ? (
          <>
            <path d={areaOf(accumulation)} fill="#fafafa" opacity="0.12" />
            <path d={pathOf(accumulation)} fill="none" stroke="#fafafa" strokeWidth="2.5" strokeLinejoin="round" />
          </>
        ) : null}
        {drawdownLine.length > 0 ? (
          <>
            <path d={areaOf(drawdownLine)} fill="#a8a29e" opacity="0.16" />
            <path
              d={pathOf(drawdownLine)}
              fill="none"
              stroke="#d6d3d1"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeDasharray="8 6"
            />
          </>
        ) : null}
        {sweep && sweepText ? (
          <g>
            <title>{sweepText}</title>
            <line
              x1={xOf(sweep.age)}
              x2={xOf(sweep.age)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="#FDE047"
              strokeWidth="2"
            />
            <circle cx={xOf(sweep.age)} cy={yOf(show(sweep.balance, sweep.age))} r="5.5" fill="#FDE047" />
          </g>
        ) : null}
        {hover ? (
          <g>
            <line
              x1={xOf(hover.age)}
              x2={xOf(hover.age)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="#fafafa"
              strokeOpacity="0.35"
            />
            <circle cx={xOf(hover.age)} cy={yOf(show(hover.balance, hover.age))} r="4.5" fill="#fafafa" />
          </g>
        ) : null}
        {accumulation.length > 1 ? (
          <text
            x={toXY(accumulation[Math.floor(accumulation.length / 2)]).x}
            y={Math.max(PAD.top + 16, toXY(accumulation[Math.floor(accumulation.length / 2)]).y - 12)}
            textAnchor="middle"
            fill="#fafafa"
            fontSize="13"
            fontWeight="700"
          >
            Saving
          </text>
        ) : null}
        {drawdown.length > 1 ? (
          <text
            x={toXY(drawdown[Math.floor(drawdown.length / 2)]).x}
            y={Math.max(PAD.top + 16, toXY(drawdown[Math.floor(drawdown.length / 2)]).y - 12)}
            textAnchor="middle"
            fill="#d6d3d1"
            fontSize="13"
            fontWeight="700"
          >
            Retirement
          </text>
        ) : null}
        {xTicks.map((age) => (
          <text key={age} x={xOf(age)} y={VIEW_H - 12} textAnchor="middle" fill="#d4d4d4" fontSize="12">
            {formatAge(age)}
          </text>
        ))}
      </svg>
      <figcaption className="flex flex-col gap-2 text-sm leading-6 text-[#D4D4D4]">
        <p>
          {mode === "today"
            ? "Showing Today's money. Each amount is the future balance divided by inflation since today."
            : "Showing Future money, the balance in the year it is reached, before adjusting for inflation."}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <span className="h-1 w-5 rounded-full bg-white" aria-hidden="true" />
            Working years
          </span>
          <span className="inline-flex items-center gap-2">
            <svg width="22" height="8" aria-hidden="true" className="shrink-0">
              <line x1="0" y1="4" x2="22" y2="4" stroke="#d6d3d1" strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            Retirement, dashed
          </span>
          {sweepText ? (
            <span className="inline-flex items-center gap-2 text-yellow">
              <span className="inline-block size-2.5 rounded-full bg-yellow" aria-hidden="true" />
              {sweepText}
            </span>
          ) : null}
          {moneyRunsOutAge !== null ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-5 rounded-sm bg-[#3a2424]" aria-hidden="true" />
              After the money runs out
            </span>
          ) : null}
          {hover ? (
            <span className="font-medium text-white tabular-nums">
              Age {formatAge(hover.age)} · {formatMoney(show(hover.balance, hover.age), currency)} in {dollars}
            </span>
          ) : (
            <span>Tap or hover the chart for a balance.</span>
          )}
        </div>
      </figcaption>
      <details className="rounded-2xl border border-[#8D8D8D] px-4 py-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Year-by-year balances</summary>
        <div className="mt-3 max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Balance at each whole year of age, in {dollars}</caption>
            <thead>
              <tr className="text-[#D4D4D4]">
                <th scope="col" className="py-1 pr-3 font-medium">Age</th>
                <th scope="col" className="py-1 pr-3 font-medium">Balance in {dollars}</th>
                <th scope="col" className="py-1 font-medium">Phase</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((point) => {
                const moved = (point.oaSweep ?? 0) > 0 ? show(point.oaSweep ?? 0, point.age) : 0;
                return (
                  <tr key={`${point.age}-${point.phase}`} className="border-t border-[#3a3a3a]">
                    <td className="py-1.5 pr-3">{formatAge(point.age)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {formatMoney(show(point.balance, point.age), currency)}
                      {moved > 0 ? (
                        <span className="mt-1 block text-yellow">
                          {formatMoney(moved, currency)} moved from CPF Ordinary Account
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5">{point.phase === "accumulation" ? "Saving" : "Drawing down"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
