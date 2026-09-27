import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChildEducationCard } from "@/components/child-education";
import { EstimateTag } from "@/components/estimate-tag";
import { applyOverseasPreset, applyStudyChoice } from "@/lib/finance/education-choice";
import { createChildForm, type ChildForm } from "@/lib/finance/plan-form";

function educationCard(child: ChildForm): string {
  return renderToStaticMarkup(
    <ChildEducationCard
      child={child}
      index={0}
      fieldError={() => undefined}
      onChild={() => undefined}
      onRemove={() => undefined}
    />,
  );
}

describe("Estimate tag", () => {
  it("is a static label, not a control", () => {
    const html = renderToStaticMarkup(<EstimateTag />);
    expect(html).toContain("Estimate");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("aria-expanded");
    expect(html).not.toContain("aria-controls");
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain("focus-visible");
    expect(html.startsWith("<span")).toBe(true);
    expect(html).not.toContain("min-h-11");
    expect(html).not.toContain("border");
    expect(html).not.toContain("rounded-full");
  });

  it("shows the label on an education preset and hides it for Custom", () => {
    const base = createChildForm("child-1");
    const local = { ...base, ...applyStudyChoice(base, "local"), id: base.id };
    const overseas = { ...base, ...applyOverseasPreset(applyStudyChoice(base, "overseas"), "uk"), id: base.id };
    const custom = { ...base, ...applyStudyChoice(local, "custom"), id: base.id };

    const localHtml = educationCard(local);
    const overseasHtml = educationCard(overseas);
    const customHtml = educationCard(custom);

    expect(localHtml.match(/Estimate/g)).toHaveLength(2);
    expect(overseasHtml.match(/Estimate/g)).toHaveLength(2);
    expect(customHtml).not.toContain("Estimate");
    for (const html of [localHtml, overseasHtml]) {
      const tags = html.match(/<span[^>]*>Estimate<\/span>/g) ?? [];
      expect(tags).toHaveLength(2);
      for (const tag of tags) {
        expect(tag).not.toContain("aria-expanded");
        expect(tag).not.toContain("aria-controls");
        expect(tag).not.toContain("tabindex");
      }
    }
    expect(localHtml).not.toContain("Tuition is the 2026");
    expect(overseasHtml).not.toContain("visa minimum");
  });
});
