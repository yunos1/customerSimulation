import { resolveThresholds } from "./balance";
import type { Customer, CustomerRound } from "./types";

export function getActiveRound(customer: Customer, roundIndex: number): CustomerRound {
  return customer.rounds[Math.min(roundIndex, customer.rounds.length - 1)];
}

export function shouldResolveCustomer(
  customer: Customer,
  round: CustomerRound,
  nextRoundIndex: number,
  satisfaction: number,
  anger: number,
) {
  return (
    round.resolveAfter ||
    nextRoundIndex >= customer.rounds.length ||
    satisfaction >= resolveThresholds.satisfaction ||
    anger <= resolveThresholds.anger
  );
}
