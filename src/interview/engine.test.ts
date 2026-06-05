import { describe, expect, it } from "vitest";
import { getCandidatesForRole, interviewRoles } from "./content";
import {
  buildDecisionRecord,
  buildInterviewSummary,
  createHistoryRecord,
  getAskedCoverage,
  getSignalSummary,
  mergeInterviewMetrics,
} from "./engine";
import type { HiringDecision, QuestionId } from "./types";

const role = interviewRoles[0];
const [polishedCandidate, strongCandidate, growthCandidate] = getCandidatesForRole(role.id);

function recordFor(candidate = strongCandidate, decision: HiringDecision = "hire", questions?: QuestionId[]) {
  return buildDecisionRecord({
    candidate,
    role,
    difficulty: "steady",
    decision,
    askedQuestionIds: questions ?? ["impact", "deep_dive", "collaboration", "motivation"],
  });
}

describe("interviewer game engine", () => {
  it("rewards matching the candidate recommendation", () => {
    const correctRecord = recordFor(strongCandidate, "hire");
    const wrongRecord = recordFor(strongCandidate, "reject");

    expect(correctRecord.decisionScore).toBeGreaterThan(wrongRecord.decisionScore);
    expect(correctRecord.evidenceScore).toBeGreaterThan(70);
    expect(correctRecord.verdict).toContain("判断命中");
  });

  it("penalizes hiring from pedigree signals without evidence", () => {
    const haloHire = recordFor(polishedCandidate, "hire", ["pedigree", "motivation"]);
    const evidenceBasedWaitlist = recordFor(polishedCandidate, "waitlist", [
      "impact",
      "deep_dive",
      "collaboration",
      "pressure",
    ]);

    expect(haloHire.biasControl).toBeLessThan(evidenceBasedWaitlist.biasControl);
    expect(haloHire.blindSpots.some((item) => item.includes("证据"))).toBe(true);
    expect(evidenceBasedWaitlist.decisionScore).toBe(100);
  });

  it("summarizes a full round and keeps the best candidate visible", () => {
    const records = [
      recordFor(polishedCandidate, "waitlist", ["impact", "deep_dive", "collaboration", "motivation"]),
      recordFor(strongCandidate, "hire", ["impact", "deep_dive", "collaboration", "motivation"]),
      recordFor(growthCandidate, "waitlist", ["impact", "deep_dive", "collaboration", "motivation"]),
    ];
    const summary = buildInterviewSummary(records, role, "steady");
    const history = createHistoryRecord(summary, role);

    expect(summary.totalScore).toBeGreaterThan(75);
    expect(summary.bestCandidateName).toBe(strongCandidate.name);
    expect(summary.suggestions.length).toBeGreaterThan(0);
    expect(history.accuracy).toBe(summary.metrics.accuracy);
  });

  it("tracks question coverage and signal mix", () => {
    const coverage = getAskedCoverage(["impact", "collaboration", "pedigree"]);
    const record = recordFor(growthCandidate, "waitlist", ["impact", "collaboration", "pedigree"]);
    const signalSummary = getSignalSummary(record.discoveredSignals);
    const metrics = mergeInterviewMetrics([record]);

    expect(coverage.hasEvidence).toBe(true);
    expect(coverage.hasTeam).toBe(true);
    expect(coverage.hasMotivation).toBe(false);
    expect(signalSummary.positives + signalSummary.warnings + signalSummary.neutral).toBe(
      record.discoveredSignals.length,
    );
    expect(metrics.accuracy).toBe(record.decisionScore);
  });
});
