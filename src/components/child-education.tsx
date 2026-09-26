"use client";

import type { KeyboardEvent } from "react";
import { EstimateTag } from "@/components/estimate-tag";
import { NumberField } from "@/components/number-field";
import {
  activePresetId,
  applyOverseasPreset,
  applyStudyChoice,
  editEducationFigure,
  educationTotalCopy,
  presetEstimateExplanation,
  presetEstimateFigure,
  pressEducationChoice,
  type EducationChoice,
  type OverseasPresetId,
} from "@/lib/finance/education-choice";
import type { ChildForm } from "@/lib/finance/plan-form";

const STUDY_OPTIONS: { value: EducationChoice; label: string }[] = [
  { value: "local", label: "Local university" },
  { value: "overseas", label: "Overseas university" },
  { value: "custom", label: "Custom" },
];

const OVERSEAS_OPTIONS: { value: OverseasPresetId; label: string }[] = [
  { value: "uk", label: "UK" },
  { value: "australia", label: "Australia" },
  { value: "us-public", label: "US public" },
  { value: "us-private", label: "US private" },
];

function costHint(preset: ReturnType<typeof activePresetId>): string {
  if (preset === "local") {
    return "Subsidised NUS or NTU tuition plus living costs, with the child living at home. In today’s prices.";
  }
  if (preset === "uk") {
    return "International tuition plus the visa living-cost minimum outside London. In today’s prices.";
  }
  if (preset === "australia") {
    return "Tuition plus the student-visa living-cost minimum. In today’s prices.";
  }
  if (preset === "us-public" || preset === "us-private") {
    return "Tuition plus room and board, in today’s prices.";
  }
  return "Fees and living costs for one year, in today’s prices.";
}

export function ChildEducationCard({
  child,
  index,
  studyError,
  overseasError,
  fieldError,
  onChild,
  onRemove,
  onOpenEstimate,
}: {
  child: ChildForm;
  index: number;
  studyError?: string;
  overseasError?: string;
  fieldError: (field: string) => string | undefined;
  onChild: (child: ChildForm) => void;
  onRemove: () => void;
  onOpenEstimate: (figure: string) => void;
}) {
  const studyLabelId = `study-label-${child.id}`;
  const studyHintId = `study-hint-${child.id}`;
  const studyErrorId = `study-error-${child.id}`;
  const overseasLabelId = `overseas-label-${child.id}`;
  const overseasHintId = `overseas-hint-${child.id}`;
  const overseasErrorId = `overseas-error-${child.id}`;
  const overseasGroupId = `overseas-${child.id}`;
  const preset = activePresetId(child);
  const total = educationTotalCopy(child);
  const estimateTag = (slot: "years" | "cost") =>
    preset ? (
      <EstimateTag
        id={`edu-estimate-${slot}-${child.id}`}
        explanation={presetEstimateExplanation(preset)}
        onOpen={() => onOpenEstimate(presetEstimateFigure(preset))}
      />
    ) : null;

  const selectStudy = (choice: EducationChoice, activation: string) => {
    const next = pressEducationChoice({
      current: child.educationChoice,
      pressed: choice,
      activation,
    });
    if (next === null || next === child.educationChoice) return;
    onChild(applyStudyChoice(child, next));
  };

  const selectOverseas = (presetId: OverseasPresetId, activation: string) => {
    const next = pressEducationChoice({
      current: child.overseasPreset,
      pressed: presetId,
      activation,
    });
    if (next === null || next === child.overseasPreset) return;
    onChild(applyOverseasPreset(child, next));
  };

  const onChoiceKey = (event: KeyboardEvent<HTMLButtonElement>, choose: (activation: string) => void) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    choose(event.key);
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-4 rounded-[32px] border border-border p-4">
      <legend className="px-1 text-sm font-semibold">Child {index + 1}</legend>

      <div className="flex flex-col gap-2">
        <p id={studyLabelId} className="text-sm font-medium text-white">
          Where will they study?
        </p>
        <p id={studyHintId} className="text-sm leading-5 text-muted">
          A preset fills the yearly cost and the number of years. Nothing is selected until you pick one.
        </p>
        <div
          id={`study-${child.id}`}
          role="group"
          aria-labelledby={studyLabelId}
          aria-describedby={studyError ? `${studyHintId} ${studyErrorId}` : studyHintId}
          tabIndex={studyError ? -1 : undefined}
          className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap"
        >
          {STUDY_OPTIONS.map((option) => {
            const selected = child.educationChoice === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`choice-pill pill w-full sm:w-auto ${selected ? "pill-shout" : "pill-ghost"}`}
                aria-pressed={selected}
                aria-expanded={option.value === "overseas" ? child.educationChoice === "overseas" : undefined}
                aria-controls={option.value === "overseas" ? overseasGroupId : undefined}
                onClick={() => selectStudy(option.value, "click")}
                onKeyDown={(event) => onChoiceKey(event, (activation) => selectStudy(option.value, activation))}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {studyError ? (
          <p id={studyErrorId} role="alert" className="text-sm leading-5 text-danger">
            {studyError}
          </p>
        ) : null}
      </div>

      {child.educationChoice === "overseas" ? (
        <div className="flex flex-col gap-2">
          <p id={overseasLabelId} className="text-sm font-medium text-white">
            Which country?
          </p>
          <p id={overseasHintId} className="text-sm leading-5 text-muted">
            UK, Australia, US public, or US private. Nothing is selected until you pick one.
          </p>
          <div
            id={overseasGroupId}
            role="group"
            aria-labelledby={overseasLabelId}
            aria-describedby={overseasError ? `${overseasHintId} ${overseasErrorId}` : overseasHintId}
            tabIndex={overseasError ? -1 : undefined}
            className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap"
          >
            {OVERSEAS_OPTIONS.map((option) => {
              const selected = child.overseasPreset === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`choice-pill pill w-full sm:w-auto ${selected ? "pill-shout" : "pill-ghost"}`}
                  aria-pressed={selected}
                  onClick={() => selectOverseas(option.value, "click")}
                  onKeyDown={(event) => onChoiceKey(event, (activation) => selectOverseas(option.value, activation))}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {overseasError ? (
            <p id={overseasErrorId} role="alert" className="text-sm leading-5 text-danger">
              {overseasError}
            </p>
          ) : null}
        </div>
      ) : null}

      <NumberField
        id={`child-age-${child.id}`}
        label="Child’s age now"
        hint="Used to time the costs."
        value={child.currentAge}
        onChange={(value) => onChild({ ...child, currentAge: value })}
        suffix="years"
        error={fieldError("childAge")}
      />
      <NumberField
        id={`child-start-${child.id}`}
        label="Age costs start"
        hint="Often 18 or 19 for university."
        value={child.startAge}
        onChange={(value) => onChild({ ...child, startAge: value })}
        suffix="years"
        error={fieldError("childStartAge")}
      />
      <NumberField
        id={`child-years-${child.id}`}
        label="Years of costs"
        hint="One withdrawal a year. Editing this switches a preset to Custom."
        value={child.years}
        onChange={(value) => onChild(editEducationFigure(child, "years", value))}
        suffix="years"
        error={fieldError("childYears")}
        describedByExtra={studyHintId}
        labelAddon={estimateTag("years")}
      />
      <NumberField
        id={`child-cost-${child.id}`}
        label="Yearly cost"
        hint={costHint(preset)}
        value={child.yearlyCostToday}
        onChange={(value) => onChild(editEducationFigure(child, "yearlyCostToday", value))}
        prefix="S$"
        error={fieldError("childCost")}
        describedByExtra={studyHintId}
        labelAddon={estimateTag("cost")}
      />
      {total ? (
        <p className="text-sm leading-6 text-white">
          <span className="sr-only">{total.accessible}</span>
          <span aria-hidden="true">{total.visible}</span>
        </p>
      ) : null}
      <button type="button" className="pill pill-ghost self-start text-sm" onClick={onRemove}>
        Remove
      </button>
    </fieldset>
  );
}
