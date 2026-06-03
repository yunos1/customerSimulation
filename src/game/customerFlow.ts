import type { Customer, CustomerRound } from "./types";

export function getActiveRound(customer: Customer, roundIndex: number): CustomerRound {
  return customer.rounds[Math.min(roundIndex, customer.rounds.length - 1)];
}

export function getReactionLine(round: CustomerRound, reactionKind: "success" | "neutral" | "failure") {
  if (reactionKind === "success") {
    return round.successLine;
  }

  if (reactionKind === "failure") {
    return round.failureLine;
  }

  return round.neutralLine;
}

export function shouldResolveCustomer(
  customer: Customer,
  round: CustomerRound,
  nextRoundIndex: number,
  satisfaction: number,
  anger: number,
) {
  return round.resolveAfter || nextRoundIndex >= customer.rounds.length || satisfaction >= 88 || anger <= 8;
}
