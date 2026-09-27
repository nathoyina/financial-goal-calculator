/** @vitest-environment happy-dom */

import { readFileSync } from "node:fs";
import path from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { PlannerApp } from "@/components/planner-app";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<PlannerApp />);
  });
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function key(element: Element, keyName: string) {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: keyName, bubbles: true }));
  });
}

function buttonNamed(name: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === name);
  if (!found) throw new Error(`No button named ${name}`);
  return found;
}

function heading(): string {
  return document.getElementById("planner-heading")?.textContent?.trim() ?? "";
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("residency selection", () => {
  it("does not scale a pressed pill, which would move it off the pointer", () => {
    const css = readFileSync(path.resolve("src/app/globals.css"), "utf8");
    expect(css).not.toMatch(/\.pill:active[^{]*\{[^}]*transform/);
  });

  it("keeps Continue on the first step until a residency is chosen", () => {
    mount();
    click(buttonNamed("Continue"));
    expect(heading()).toBe("At what age do you want to retire?");
    expect(document.querySelector("[role='alert']")?.textContent).toContain(
      "Choose Singapore Citizen, Permanent Resident, or Foreigner.",
    );
  });

  it.each(["Singapore Citizen", "Permanent Resident", "Foreigner"])("selects %s and moves forward", (label) => {
    mount();
    const pill = buttonNamed(label);
    click(pill);
    expect(pill.getAttribute("aria-pressed")).toBe("true");
    expect(pill.className).toContain("pill-shout");
    for (const other of document.querySelectorAll("#residency button")) {
      if (other === pill) continue;
      expect(other.getAttribute("aria-pressed")).toBe("false");
      expect(other.className).toContain("pill-ghost");
    }
    if (label === "Permanent Resident") {
      expect(document.getElementById("pr-rates")?.textContent).toContain("This plan uses full rates.");
    } else {
      expect(document.getElementById("pr-rates")).toBeNull();
    }
    click(buttonNamed("Continue"));
    expect(heading()).toBe("Income and spending");
  });

  it("opens the CPF balances form for a citizen or permanent resident, and skips it for a foreigner", () => {
    for (const [label, cpfStep] of [
      ["Singapore Citizen", true],
      ["Permanent Resident", true],
      ["Foreigner", false],
    ] as const) {
      mount();
      click(buttonNamed(label));
      click(buttonNamed("Continue"));
      click(buttonNamed("Continue"));
      expect(heading()).toBe("Are you still paying a home loan?");
      click(buttonNamed("No"));
      if (cpfStep) {
        expect(heading()).toBe("Your CPF balances today");
        expect(document.getElementById("oa")).not.toBeNull();
      } else {
        expect(heading()).toBe("Planning for children's education?");
        expect(document.getElementById("oa")).toBeNull();
      }
      act(() => root?.unmount());
      container?.remove();
      root = null;
      container = null;
    }
  });

  it("selects the next and previous residency with the arrow keys", () => {
    mount();
    const [citizen, resident, foreigner] = [...document.querySelectorAll<HTMLButtonElement>("#residency button")];
    citizen.focus();
    key(citizen, "ArrowRight");
    expect(resident.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(resident);
    key(resident, "ArrowDown");
    expect(foreigner.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(foreigner);
    key(foreigner, "ArrowLeft");
    expect(resident.getAttribute("aria-pressed")).toBe("true");
    key(resident, "ArrowUp");
    expect(citizen.getAttribute("aria-pressed")).toBe("true");
    key(citizen, "ArrowUp");
    expect(foreigner.getAttribute("aria-pressed")).toBe("true");
    click(buttonNamed("Continue"));
    expect(heading()).toBe("Income and spending");
  });
});
