import { describe, expect, it } from "vitest";
import { clonePresetShifts, employees, getScenario } from "./content";
import { evaluateRoster } from "./engine";

const baseModifiers = {
  trafficLift: 0,
  extendedClose: false,
};

describe("evaluateRoster", () => {
  it("keeps the balanced weekday roster in a usable range", () => {
    const evaluation = evaluateRoster({
      employees,
      modifiers: baseModifiers,
      scenario: getScenario("weekday"),
      shifts: clonePresetShifts("balanced"),
    });

    expect(evaluation.metrics.totalScore).toBeGreaterThan(55);
    expect(evaluation.metrics.scheduledCost).toBeLessThanOrEqual(3600);
  });

  it("rewards a service-heavy plan during a lifted promo day", () => {
    const lean = evaluateRoster({
      employees,
      modifiers: { ...baseModifiers, trafficLift: 20 },
      scenario: getScenario("promo"),
      shifts: clonePresetShifts("lean"),
    });
    const service = evaluateRoster({
      employees,
      modifiers: { ...baseModifiers, trafficLift: 20 },
      scenario: getScenario("promo"),
      shifts: clonePresetShifts("service"),
    });

    expect(service.metrics.serviceScore).toBeGreaterThan(lean.metrics.serviceScore);
    expect(lean.metrics.uncoveredHours).toBeGreaterThan(service.metrics.uncoveredHours);
  });

  it("flags an absent employee as an operational risk", () => {
    const evaluation = evaluateRoster({
      employees,
      modifiers: { ...baseModifiers, absentEmployeeId: "zhou" },
      scenario: getScenario("weekday"),
      shifts: clonePresetShifts("balanced"),
    });

    expect(evaluation.issues.some((issue) => issue.id === "absence-zhou")).toBe(true);
  });
});
