import { describe, expect, it } from "vitest";
import { getClinicScenario, getScenarioPatients } from "./content";
import { evaluateClinicTriage, sortQueueByRisk } from "./engine";
import type { TriageDecision } from "./types";

describe("clinic triage engine", () => {
  it("prioritizes high-risk patients in the suggested queue", () => {
    const patients = getScenarioPatients("morning");
    const queue = sortQueueByRisk(patients, []);

    expect(queue[0].id).toBe("p-chest");
    expect(queue.some((patient) => patient.id === "p-dizzy")).toBe(true);
  });

  it("scores safe triage decisions above delayed low-priority handling", () => {
    const scenario = getClinicScenario("morning");
    const patients = getScenarioPatients("morning");
    const safeDecisions: TriageDecision[] = [
      { patientId: "p-chest", level: "immediate", resourceId: "resus", decidedAt: 1 },
      { patientId: "p-dizzy", level: "immediate", resourceId: "doctor", decidedAt: 10 },
      { patientId: "p-abdomen", level: "urgent", resourceId: "doctor", decidedAt: 22 },
    ];
    const unsafeDecisions: TriageDecision[] = [
      { patientId: "p-ankle", level: "immediate", resourceId: "doctor", decidedAt: 6 },
      { patientId: "p-cough", level: "soon", resourceId: "doctor", decidedAt: 13 },
      { patientId: "p-chest", level: "routine", resourceId: "nurse", decidedAt: 20 },
    ];

    const safe = evaluateClinicTriage({ decisions: safeDecisions, patients, scenario });
    const unsafe = evaluateClinicTriage({ decisions: unsafeDecisions, patients, scenario });

    expect(safe.metrics.safetyScore).toBeGreaterThan(unsafe.metrics.safetyScore);
    expect(unsafe.issues.some((issue) => issue.id === "deteriorated-p-chest")).toBe(true);
  });

  it("flags resource overload when capacity is exceeded", () => {
    const scenario = getClinicScenario("pediatricNight");
    const patients = getScenarioPatients("pediatricNight");
    const decisions: TriageDecision[] = patients.slice(0, 3).map((patient, index) => ({
      patientId: patient.id,
      level: "urgent",
      resourceId: "doctor",
      decidedAt: patient.arrivalMinute + index + 1,
    }));
    const evaluation = evaluateClinicTriage({ decisions, patients, scenario });

    expect(evaluation.issues.some((issue) => issue.id === "resource-over-doctor")).toBe(true);
  });
});
