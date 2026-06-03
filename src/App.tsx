import { useMemo, useReducer } from "react";
import { activeDay } from "./content/levels";
import { createInitialState, gameReducer } from "./game/reducer";
import { ChatPanel } from "./components/ChatPanel";
import { CustomerStatus } from "./components/CustomerStatus";
import { DaySummary } from "./components/DaySummary";
import { KnowledgeBase } from "./components/KnowledgeBase";
import { Layout } from "./components/Layout";
import { MetricsBar } from "./components/MetricsBar";
import { ReplyDeck } from "./components/ReplyDeck";

export default function App() {
  const initialState = useMemo(() => createInitialState(activeDay), []);
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const activeCustomer =
    state.phase === "summary" ? undefined : activeDay.customers[state.activeCustomerIndex];

  return (
    <Layout
      metrics={<MetricsBar metrics={state.metrics} phase={state.phase} />}
      chat={
        <ChatPanel
          customer={activeCustomer}
          messages={state.messages}
          phase={state.phase}
          onStart={() => dispatch({ type: "START_DAY" })}
          onNextCustomer={() => dispatch({ type: "NEXT_CUSTOMER" })}
        />
      }
      status={
        <CustomerStatus
          customer={activeCustomer}
          metrics={state.metrics}
          customerOutcome={state.currentCustomerOutcome}
        />
      }
      knowledge={<KnowledgeBase policies={activeDay.policies} />}
      replies={
        state.phase === "summary" ? (
          <DaySummary summary={state.summary} onRestart={() => dispatch({ type: "RESTART_DAY" })} />
        ) : (
          <ReplyDeck
            cards={activeDay.replyCards}
            disabled={state.phase !== "player_reply"}
            onChoose={(cardId) => dispatch({ type: "CHOOSE_REPLY", cardId })}
          />
        )
      }
    />
  );
}
