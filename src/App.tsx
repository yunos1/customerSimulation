import { useEffect, useMemo, useReducer, useState } from "react";
import { activeDay } from "./content/levels";
import { createInitialState, gameReducer, getActiveSession } from "./game/reducer";
import { ChatPanel } from "./components/ChatPanel";
import { AchievementsPanel } from "./components/AchievementsPanel";
import { CustomerStatus } from "./components/CustomerStatus";
import { DaySummary } from "./components/DaySummary";
import { KnowledgeBase } from "./components/KnowledgeBase";
import { Layout } from "./components/Layout";
import { MetricsBar } from "./components/MetricsBar";
import { ReplyDeck } from "./components/ReplyDeck";
import { TimeoutAlerts } from "./components/TimeoutAlerts";

export default function App() {
  const initialState = useMemo(() => createInitialState(activeDay, Date.now()), []);
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [scrollTargetSessionId, setScrollTargetSessionId] = useState<string>();

  const activeSession = getActiveSession(state);
  const activeCustomer = activeSession?.customer;
  const visibleMetrics = activeSession
    ? {
        satisfaction: activeSession.metrics.satisfaction,
        anger: activeSession.metrics.anger,
        companyCost: state.metrics.companyCost,
        complianceRisk: state.metrics.complianceRisk,
        timeLeft: state.metrics.timeLeft,
      }
    : state.metrics;

  useEffect(() => {
    if (state.phase === "intro" || state.phase === "summary") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      dispatch({ type: "TICK", seed: Date.now() });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [state.phase]);

  useEffect(() => {
    if (!scrollTargetSessionId || activeSession?.id !== scrollTargetSessionId) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".chat-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setScrollTargetSessionId(undefined);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeSession?.id, scrollTargetSessionId]);

  const openTimeoutSession = (sessionId: string) => {
    setScrollTargetSessionId(sessionId);
    dispatch({ type: "OPEN_TIMEOUT_ALERT", sessionId });
  };

  return (
    <Layout
      metrics={<MetricsBar metrics={visibleMetrics} phase={state.phase} />}
      chat={
        <ChatPanel
          activeSession={activeSession}
          sessions={state.sessions}
          shiftMessages={state.shiftMessages}
          phase={state.phase}
          onStart={() => dispatch({ type: "START_DAY", seed: Date.now() })}
          onSelectSession={(sessionId) => dispatch({ type: "SELECT_SESSION", sessionId })}
        />
      }
      status={
        <CustomerStatus
          customer={activeCustomer}
          session={activeSession}
        />
      }
      achievements={
        <AchievementsPanel
          unlockedIds={state.achievements}
          stats={state.achievementStats}
        />
      }
      knowledge={<KnowledgeBase policies={activeDay.policies} />}
      replies={
        state.phase === "summary" ? (
          <DaySummary summary={state.summary} onRestart={() => dispatch({ type: "RESTART_DAY", seed: Date.now() })} />
        ) : (
          <ReplyDeck
            cards={activeDay.replyCards}
            disabled={state.phase !== "player_reply" || activeSession?.status !== "active"}
            onChoose={(cardId) => dispatch({ type: "CHOOSE_REPLY", cardId })}
            onSubmitFreeReply={(text) => dispatch({ type: "SUBMIT_FREE_REPLY", text })}
          />
        )
      }
      alerts={
        <TimeoutAlerts
          sessions={state.sessions}
          onOpenSession={openTimeoutSession}
        />
      }
    />
  );
}
