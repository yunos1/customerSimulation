import { activeDay } from "../content/levels";
import { getActiveRound, getReactionLine, shouldResolveCustomer } from "./customerFlow";
import { applyDelta, buildDaySummary, createOutcome, scoreReply } from "./scoring";
import type { ChatMessage, Customer, CustomerRound, GameAction, GameState, LevelConfig, Metrics } from "./types";

let messageCounter = 0;

export function createInitialState(level: LevelConfig): GameState {
  const firstCustomer = level.customers[0];

  return {
    level,
    phase: "intro",
    activeCustomerIndex: 0,
    activeRoundIndex: 0,
    metrics: {
      ...level.baseMetrics,
      ...firstCustomer.initialMetrics,
    },
    messages: [
      createMessage(
        "system",
        `${level.title}｜${level.briefing}`,
      ),
    ],
    outcomes: [],
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START_DAY":
      return startCurrentCustomer(state);

    case "CHOOSE_REPLY":
      return chooseReply(state, action.cardId);

    case "NEXT_CUSTOMER":
      return moveToNextCustomer(state);

    case "RESTART_DAY":
      messageCounter = 0;
      return createInitialState(activeDay);

    default:
      return state;
  }
}

function startCurrentCustomer(state: GameState): GameState {
  if (state.phase !== "intro") {
    return state;
  }

  const customer = state.level.customers[state.activeCustomerIndex];
  const firstRound = getActiveRound(customer, 0);

  return {
    ...state,
    phase: "player_reply",
    messages: [
      ...state.messages,
      createMessage("customer", customer.opening),
      createMessage("customer", firstRound.prompt),
    ],
  };
}

function chooseReply(state: GameState, cardId: string): GameState {
  if (state.phase !== "player_reply") {
    return state;
  }

  const customer = state.level.customers[state.activeCustomerIndex];
  const round = getActiveRound(customer, state.activeRoundIndex);
  const card = state.level.replyCards.find((candidate) => candidate.id === cardId);

  if (!card) {
    return state;
  }

  const { delta, reactionKind } = scoreReply(customer, round, card);
  const nextMetrics = applyDelta(state.metrics, delta);
  const reactionLine = getReactionLine(round, reactionKind);
  const nextRoundIndex = state.activeRoundIndex + 1;
  const outcome = maybeBuildOutcome(customer, round, nextRoundIndex, nextMetrics);

  if (outcome) {
    return {
      ...state,
      phase: outcome.status === "resolved" ? "customer_resolved" : "customer_failed",
      metrics: nextMetrics,
      currentCustomerOutcome: outcome,
      messages: [
        ...state.messages,
        createMessage("agent", card.title),
        createMessage("customer", reactionLine),
        createMessage("system", getOutcomeLine(outcome.status)),
      ],
    };
  }

  const nextRound = getActiveRound(customer, nextRoundIndex);

  return {
    ...state,
    phase: "player_reply",
    activeRoundIndex: nextRoundIndex,
    metrics: nextMetrics,
    messages: [
      ...state.messages,
      createMessage("agent", card.title),
      createMessage("customer", reactionLine),
      createMessage("customer", nextRound.prompt),
    ],
  };
}

function maybeBuildOutcome(
  customer: Customer,
  round: CustomerRound,
  nextRoundIndex: number,
  metrics: Metrics,
) {
  if (
    metrics.anger >= 100 ||
    metrics.satisfaction <= 10 ||
    metrics.complianceRisk >= 100 ||
    shouldResolveCustomer(customer, round, nextRoundIndex, metrics.satisfaction, metrics.anger)
  ) {
    return createOutcome(customer, metrics);
  }

  return undefined;
}

function moveToNextCustomer(state: GameState): GameState {
  if (state.phase !== "customer_resolved" && state.phase !== "customer_failed") {
    return state;
  }

  const outcome = state.currentCustomerOutcome;
  const nextOutcomes = outcome ? [...state.outcomes, outcome] : state.outcomes;
  const nextCustomerIndex = state.activeCustomerIndex + 1;

  if (nextCustomerIndex >= state.level.customers.length) {
    const summary = buildDaySummary(state.level, state.metrics, nextOutcomes);

    return {
      ...state,
      phase: "summary",
      outcomes: nextOutcomes,
      summary,
      currentCustomerOutcome: undefined,
      messages: [
        ...state.messages,
        createMessage("system", "今日会话已全部处理完毕，主管正在生成绩效记录。"),
      ],
    };
  }

  const nextCustomer = state.level.customers[nextCustomerIndex];
  const nextRound = getActiveRound(nextCustomer, 0);

  return {
    ...state,
    phase: "player_reply",
    activeCustomerIndex: nextCustomerIndex,
    activeRoundIndex: 0,
    currentCustomerOutcome: undefined,
    metrics: {
      ...state.metrics,
      satisfaction: nextCustomer.initialMetrics.satisfaction,
      anger: nextCustomer.initialMetrics.anger,
    },
    outcomes: nextOutcomes,
    messages: [
      ...state.messages,
      createMessage("system", `新会话接入：${nextCustomer.name}。`),
      createMessage("customer", nextCustomer.opening),
      createMessage("customer", nextRound.prompt),
    ],
  };
}

function getOutcomeLine(status: "resolved" | "complaint" | "compliance_escalation") {
  if (status === "resolved") {
    return "会话已结束：客户接受了当前处理方案。";
  }

  if (status === "compliance_escalation") {
    return "会话已升级：主管发现合规风险过高。";
  }

  return "会话已结束：客户提交了投诉记录。";
}

function createMessage(speaker: ChatMessage["speaker"], text: string): ChatMessage {
  messageCounter += 1;

  return {
    id: `msg-${messageCounter}`,
    speaker,
    text,
  };
}
