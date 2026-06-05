import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { buildLevelConfig, career, getCareerDay, getNextDayId, isPassingGrade } from "./content/career";
import { requestAiCustomerReply } from "./game/aiCustomerReply";
import { createInitialState, gameReducer, getActiveSession } from "./game/reducer";
import { useMetaProgress } from "./hooks/useMetaProgress";
import type { UnlockableCard } from "./game/types";
import { ChatPanel } from "./components/ChatPanel";
import { AchievementsPanel } from "./components/AchievementsPanel";
import { CareerMap } from "./components/CareerMap";
import type { CareerMapDay } from "./components/CareerMap";
import { CustomerStatus } from "./components/CustomerStatus";
import { DaySummary } from "./components/DaySummary";
import { KnowledgeBase } from "./components/KnowledgeBase";
import { InterviewSimulator } from "./components/InterviewSimulator";
import { Layout } from "./components/Layout";
import { MetricsBar } from "./components/MetricsBar";
import { ReplyDeck } from "./components/ReplyDeck";
import { SimulatorHub } from "./components/SimulatorHub";
import { TimeoutAlerts } from "./components/TimeoutAlerts";
import { UnlockToast } from "./components/UnlockToast";
import { unlockableCards } from "./content/unlockableCards";

const firstDay = career.days[0];

export default function App() {
  // 职业进度持久化在 meta 层（独立于 per-run GameState，跨浏览器会话保存）。
  const { meta, selectDay, recordDayResult, resetCareer } = useMetaProgress();
  const { currentDayId, unlockedDayIds, bestGrades } = meta;
  const [activeSimulator, setActiveSimulator] = useState<"hub" | "support" | "interview">("hub");
  // career_map 是职业地图视图；进入某天后才创建 per-day 引擎 state。
  const [view, setView] = useState<"career_map" | "shift">("career_map");

  const currentDay = getCareerDay(currentDayId) ?? firstDay;
  const initialState = useMemo(
    () => createInitialState(buildLevelConfig(firstDay), Date.now()),
    [],
  );
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [scrollTargetSessionId, setScrollTargetSessionId] = useState<string>();
  const [pendingReplySessionId, setPendingReplySessionId] = useState<string>();
  // 本次新解锁、待 toast 展示的高级卡。
  const [newlyUnlockedCards, setNewlyUnlockedCards] = useState<UnlockableCard[]>([]);
  // 防止 summary 阶段的重复渲染多次记录成绩。
  const recordedSummaryRef = useRef<string | undefined>(undefined);
  // 上一次已知的解锁卡集合，用于 diff 出「新」解锁（初始化为当前已解锁，避免开局误报）。
  const knownUnlockedRef = useRef<Set<string>>(new Set(meta.unlockedCardIds));

  const activeSession = getActiveSession(state);
  const activeCustomer = activeSession?.customer;
  const activeLevel = state.level;
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
    if (
      activeSimulator !== "support" ||
      view !== "shift" ||
      state.phase === "intro" ||
      state.phase === "summary"
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      dispatch({ type: "TICK", seed: Date.now() });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [activeSimulator, state.phase, view]);

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

  // 进入 summary 时把结果并入 meta（更新最佳评级 / 解锁下一天 / 累计记录），每个 summary 只记一次。
  // ref 守卫同时防住 summary 阶段的重复渲染与 StrictMode 双调用，避免 records 重复累加。
  useEffect(() => {
    if (state.phase !== "summary" || !state.summary) {
      return;
    }

    const summaryKey = `${currentDayId}:${state.summary.grade}:${state.outcomes.length}`;

    if (recordedSummaryRef.current === summaryKey) {
      return;
    }

    recordedSummaryRef.current = summaryKey;

    const resolvedCount = state.outcomes.filter((outcome) => outcome.status === "resolved").length;

    recordDayResult({
      dayId: currentDayId,
      grade: state.summary.grade,
      achievements: state.achievements,
      resolvedCount,
      complaintCount: state.outcomes.length - resolvedCount,
      finalSatisfaction: state.summary.totals.satisfaction,
    });
  }, [state.phase, state.summary, state.outcomes, state.achievements, currentDayId, recordDayResult]);

  // 检测新解锁的高级卡：对比 meta.unlockedCardIds 与上次已知集合，差集即「新」解锁。
  // 用 ref 持有已知集合，StrictMode 双调用安全（ref 跨调用持久，不会重复弹同一张）。
  useEffect(() => {
    const known = knownUnlockedRef.current;
    const freshIds = meta.unlockedCardIds.filter((id) => !known.has(id));

    if (freshIds.length === 0) {
      return;
    }

    meta.unlockedCardIds.forEach((id) => known.add(id));

    const freshSet = new Set(freshIds);
    setNewlyUnlockedCards(unlockableCards.filter((entry) => freshSet.has(entry.card.id)));
  }, [meta.unlockedCardIds]);

  const dismissUnlockToast = useCallback(() => setNewlyUnlockedCards([]), []);
  const launchSupportSimulator = useCallback(() => setActiveSimulator("support"), []);
  const launchInterviewSimulator = useCallback(() => setActiveSimulator("interview"), []);
  const backToHub = useCallback(() => setActiveSimulator("hub"), []);

  const enterDay = useCallback(
    (dayId: string) => {
      const day = getCareerDay(dayId);

      if (!day) {
        return;
      }

      recordedSummaryRef.current = undefined;
      selectDay(dayId);
      setView("shift");
      dispatch({
        type: "LOAD_DAY",
        level: buildLevelConfig(day, career, meta.unlockedCardIds),
        seed: Date.now(),
      });
    },
    [selectDay, meta.unlockedCardIds],
  );

  const openTimeoutSession = useCallback((sessionId: string) => {
    setScrollTargetSessionId(sessionId);
    dispatch({ type: "OPEN_TIMEOUT_ALERT", sessionId });
  }, []);

  const handleStart = useCallback(() => dispatch({ type: "START_DAY", seed: Date.now() }), []);
  const handleSelectSession = useCallback(
    (sessionId: string) => dispatch({ type: "SELECT_SESSION", sessionId }),
    [],
  );
  const handleChoose = useCallback(
    (cardId: string) => {
      const session = getActiveSession(state);

      if (state.phase !== "player_reply" || !session || session.status !== "active" || pendingReplySessionId) {
        return;
      }

      setPendingReplySessionId(session.id);
      void requestAiCustomerReply(state, session, { kind: "card", cardId })
        .then((aiReactionLine) => {
          dispatch({ type: "CHOOSE_REPLY", cardId, sessionId: session.id, aiReactionLine });
        })
        .finally(() => {
          setPendingReplySessionId((currentId) => (currentId === session.id ? undefined : currentId));
        });
    },
    [pendingReplySessionId, state],
  );
  const handleSubmitFreeReply = useCallback(
    (text: string) => {
      const session = getActiveSession(state);

      if (state.phase !== "player_reply" || !session || session.status !== "active" || pendingReplySessionId) {
        return;
      }

      setPendingReplySessionId(session.id);
      void requestAiCustomerReply(state, session, { kind: "free", text })
        .then((aiReactionLine) => {
          dispatch({ type: "SUBMIT_FREE_REPLY", text, sessionId: session.id, aiReactionLine });
        })
        .finally(() => {
          setPendingReplySessionId((currentId) => (currentId === session.id ? undefined : currentId));
        });
    },
    [pendingReplySessionId, state],
  );
  const handleRetry = useCallback(() => {
    recordedSummaryRef.current = undefined;
    dispatch({
      type: "RESTART_DAY",
      level: buildLevelConfig(currentDay, career, meta.unlockedCardIds),
      seed: Date.now(),
    });
  }, [currentDay, meta.unlockedCardIds]);
  const handleAdvance = useCallback(() => {
    const nextDayId = getNextDayId(currentDayId);

    if (nextDayId) {
      enterDay(nextDayId);
    } else {
      setView("career_map");
    }
  }, [currentDayId, enterDay]);
  const handleBackToMap = useCallback(() => setView("career_map"), []);
  const handleResetCareer = useCallback(() => {
    if (window.confirm("确定要重置整条生涯进度吗？解锁与最佳评级都会清空。")) {
      knownUnlockedRef.current = new Set();
      setNewlyUnlockedCards([]);
      resetCareer();
    }
  }, [resetCareer]);

  const careerMapDays = useMemo<CareerMapDay[]>(
    () =>
      career.days.map((day) => ({
        day,
        unlocked: unlockedDayIds.includes(day.id),
        bestGrade: bestGrades[day.id],
        isCurrent: day.id === currentDayId,
      })),
    [unlockedDayIds, bestGrades, currentDayId],
  );

  const passed =
    state.phase === "summary" && state.summary
      ? isPassingGrade(state.summary.grade, currentDay.passGrade)
      : false;
  const hasNextDay = Boolean(getNextDayId(currentDayId));

  if (activeSimulator === "hub") {
    return (
      <SimulatorHub
        unlockedDays={unlockedDayIds.length}
        totalDays={career.days.length}
        gradedDays={Object.keys(bestGrades).length}
        onLaunchSupport={launchSupportSimulator}
        onLaunchInterview={launchInterviewSimulator}
      />
    );
  }

  if (activeSimulator === "interview") {
    return <InterviewSimulator onBackToHub={backToHub} />;
  }

  return (
    <Layout
      onBackToHub={backToHub}
      metrics={<MetricsBar metrics={visibleMetrics} phase={state.phase} />}
      chat={
        view === "career_map" ? (
          <CareerMap days={careerMapDays} onSelectDay={enterDay} onResetCareer={handleResetCareer} />
        ) : (
          <ChatPanel
            activeSession={activeSession}
            sessions={state.sessions}
            shiftMessages={state.shiftMessages}
            phase={state.phase}
            onStart={handleStart}
            onSelectSession={handleSelectSession}
          />
        )
      }
      status={<CustomerStatus customer={activeCustomer} session={activeSession} />}
      achievements={
        <AchievementsPanel unlockedIds={state.achievements} stats={state.achievementStats} />
      }
      knowledge={<KnowledgeBase policies={activeLevel.policies} />}
      replies={
        view === "shift" && state.phase === "summary" ? (
          <DaySummary
            summary={state.summary}
            passGrade={currentDay.passGrade}
            passed={passed}
            hasNextDay={hasNextDay}
            onAdvance={handleAdvance}
            onRetry={handleRetry}
            onBackToMap={handleBackToMap}
          />
        ) : (
          <ReplyDeck
            cards={activeLevel.replyCards}
            disabled={
              view !== "shift" ||
              state.phase !== "player_reply" ||
              activeSession?.status !== "active" ||
              Boolean(pendingReplySessionId)
            }
            isThinking={Boolean(pendingReplySessionId)}
            onChoose={handleChoose}
            onSubmitFreeReply={handleSubmitFreeReply}
          />
        )
      }
      alerts={
        <>
          <TimeoutAlerts sessions={state.sessions} onOpenSession={openTimeoutSession} />
          <UnlockToast cards={newlyUnlockedCards} onDismiss={dismissUnlockToast} />
        </>
      }
    />
  );
}
