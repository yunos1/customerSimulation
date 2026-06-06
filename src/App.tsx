import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  buildLevelConfig,
  getCareerDay,
  getNextDayId,
  getSupportMode,
  isPassingGrade,
  supportModeOrder,
  supportModes,
  type SupportModeId,
} from "./content/career";
import { requestAiCustomerReplyStream } from "./game/aiCustomerReply";
import { createInitialState, gameReducer, getActiveSession } from "./game/reducer";
import { getModeProgress, type ModeProgress } from "./game/meta";
import { setSimulatorFavicon } from "./hooks/useFavicon";
import { useMetaProgress } from "./hooks/useMetaProgress";
import type { UnlockableCard, ReplyCard } from "./game/types";
import { ChatPanel } from "./components/ChatPanel";
import { AchievementsPanel } from "./components/AchievementsPanel";
import { CareerMap } from "./components/CareerMap";
import type { CareerMapDay } from "./components/CareerMap";
import { CustomerStatus } from "./components/CustomerStatus";
import { DaySummary } from "./components/DaySummary";
import { KnowledgeBase } from "./components/KnowledgeBase";
import { ClinicTriageSimulator } from "./components/ClinicTriageSimulator";
import { InterviewSimulator } from "./components/InterviewSimulator";
import { Layout } from "./components/Layout";
import { MetricsBar } from "./components/MetricsBar";
import { ReplyDeck } from "./components/ReplyDeck";
import { ShiftRosterSimulator } from "./components/ShiftRosterSimulator";
import { SimulatorHub } from "./components/SimulatorHub";
import { SupportModeSelect } from "./components/SupportModeSelect";
import { TimeoutAlerts } from "./components/TimeoutAlerts";
import { UnlockToast } from "./components/UnlockToast";
import { SlackerMoment } from "./components/SlackerMoment";
import { unlockableCards } from "./content/unlockableCards";
import { useAuth } from "./hooks/useAuth";
import { useProgressSync } from "./hooks/useProgressSync";

const defaultSupportModeId: SupportModeId = "workplace";
const defaultSupportMode = supportModes[defaultSupportModeId];
const firstDay = defaultSupportMode.days[0];

export default function App() {
  // 职业进度持久化在 meta 层（独立于 per-run GameState，跨浏览器会话保存）。
  const { meta, selectMode, selectDay, recordDayResult, resetCareer } = useMetaProgress();
  const { user, loading: authLoading, login, logout } = useAuth();
  useProgressSync(user ?? null, meta);
  const currentSupportMode = getSupportMode(meta.activeModeId);
  const currentModeProgress = getModeProgress(meta, currentSupportMode.id);
  const { currentDayId, unlockedDayIds, bestGrades } = currentModeProgress;
  const [activeSimulator, setActiveSimulator] = useState<
    "hub" | "support" | "interview" | "shiftRoster" | "clinicTriage" | "slacker"
  >("hub");
  // mode_select / career_map 是客服模块的选择视图；进入某天后才创建 per-day 引擎 state。
  const [view, setView] = useState<"mode_select" | "career_map" | "shift">("mode_select");

  const currentDay = getCareerDay(currentDayId, currentSupportMode) ?? currentSupportMode.days[0] ?? firstDay;
  const initialState = useMemo(
    () => createInitialState(buildLevelConfig(firstDay), Date.now()),
    // firstDay 是模块级常量，实际不会变，但补全依赖保持 lint 规则一致
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [firstDay],
  );
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [scrollTargetSessionId, setScrollTargetSessionId] = useState<string>();
  const [pendingReplySessionId, setPendingReplySessionId] = useState<string>();
  // 打字机效果：流式 AI 回复正在生成时的临时文本（undefined = 无流式输出）
  const [streamingText, setStreamingText] = useState<string | undefined>(undefined);
  // 本次新解锁、待 toast 展示的高级卡。
  const [newlyUnlockedCards, setNewlyUnlockedCards] = useState<UnlockableCard[]>([]);
  // 防止 summary 阶段的重复渲染多次记录成绩。
  const recordedSummaryRef = useRef<string | undefined>(undefined);
  // 持有最新 state 引用，避免 handleChoose/handleSubmitFreeReply 将整个 state 加入依赖。
  const stateRef = useRef(state);
  // 上一次已知的解锁卡集合，用于 diff 出「新」解锁（初始化为当前已解锁，避免开局误报）。
  const knownUnlockedRef = useRef<Set<string>>(new Set(meta.unlockedCardIds));

  stateRef.current = state;
  const activeSession = getActiveSession(state);
  const activeCustomer = activeSession?.customer;
  const activeLevel = state.level;
  const supportModeProgressByMode = useMemo(
    () =>
      supportModeOrder.reduce<Record<SupportModeId, ModeProgress>>(
        (progressByMode, modeId) => ({
          ...progressByMode,
          [modeId]: getModeProgress(meta, modeId),
        }),
        {} as Record<SupportModeId, ModeProgress>,
      ),
    [meta],
  );
  const supportModeList = useMemo(() => supportModeOrder.map((modeId) => supportModes[modeId]), []);
  const totalSupportDays = supportModeList.reduce((sum, mode) => sum + mode.days.length, 0);
  const unlockedSupportDays = supportModeList.reduce(
    (sum, mode) => sum + supportModeProgressByMode[mode.id].unlockedDayIds.length,
    0,
  );
  const gradedSupportDays = supportModeList.reduce(
    (sum, mode) => sum + Object.keys(supportModeProgressByMode[mode.id].bestGrades).length,
    0,
  );
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
    setSimulatorFavicon(activeSimulator);
  }, [activeSimulator]);

  useEffect(() => {
    if (activeSimulator !== "support" || view !== "shift") {
      return undefined;
    }

    // phase 判断移入回调，避免 phase 变化时重建 interval（防止短暂双 interval）
    const intervalId = window.setInterval(() => {
      const phase = stateRef.current.phase;
      if (phase !== "intro" && phase !== "summary") {
        dispatch({ type: "TICK", seed: Date.now() });
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [activeSimulator, view]);

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

    // 用 state.runId 作为本局唯一标识（Date.now() at createInitialState），避免计数器重置时误判。
    const summaryKey = `${state.runId}:${state.summary.grade}`;

    if (recordedSummaryRef.current === summaryKey) {
      return;
    }

    recordedSummaryRef.current = summaryKey;

    const resolvedCount = state.outcomes.filter((outcome) => outcome.status === "resolved").length;

    recordDayResult({
      modeId: currentSupportMode.id,
      dayId: currentDayId,
      grade: state.summary.grade,
      achievements: state.achievements,
      resolvedCount,
      complaintCount: state.outcomes.length - resolvedCount,
      finalSatisfaction: state.summary.totals.satisfaction,
      fastestReplySeconds: state.achievementStats.fastestReplySeconds,
    });
  }, [
    state.phase,
    state.summary,
    state.runId,
    state.outcomes,
    state.achievements,
    currentSupportMode.id,
    currentDayId,
    recordDayResult,
  ]);

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
  const launchShiftRosterSimulator = useCallback(() => setActiveSimulator("shiftRoster"), []);
  const launchClinicTriageSimulator = useCallback(() => setActiveSimulator("clinicTriage"), []);
  const launchSlackerSimulator = useCallback(() => setActiveSimulator("slacker"), []);
  const backToHub = useCallback(() => setActiveSimulator("hub"), []);
  const handleSwitchSupportMode = useCallback(() => {
    recordedSummaryRef.current = undefined;
    setPendingReplySessionId(undefined);
    setScrollTargetSessionId(undefined);
    setView("mode_select");
    dispatch({
      type: "LOAD_DAY",
      level: buildLevelConfig(currentSupportMode.days[0] ?? firstDay, currentSupportMode, meta.unlockedCardIds),
      seed: Date.now(),
    });
  }, [currentSupportMode, meta.unlockedCardIds]);
  const handleSelectSupportMode = useCallback(
    (modeId: SupportModeId) => {
      selectMode(modeId);
      setView("career_map");
      recordedSummaryRef.current = undefined;
    },
    [selectMode],
  );

  const enterDay = useCallback(
    (dayId: string) => {
      const day = getCareerDay(dayId, currentSupportMode);

      if (!day) {
        return;
      }

      recordedSummaryRef.current = undefined;
      selectDay(currentSupportMode.id, dayId);
      setView("shift");
      dispatch({
        type: "LOAD_DAY",
        level: buildLevelConfig(day, currentSupportMode, meta.unlockedCardIds),
        seed: Date.now(),
      });
    },
    [currentSupportMode, selectDay, meta.unlockedCardIds],
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
      const s = stateRef.current;
      const session = getActiveSession(s);

      if (s.phase !== "player_reply" || !session || session.status !== "active" || pendingReplySessionId) {
        return;
      }

      const sessionId = session.id;
      const runId = s.runId;
      const card = s.level.replyCards.find((c: ReplyCard) => c.id === cardId);
      if (card) dispatch({ type: "ADD_AGENT_MESSAGE", text: card.title, sessionId });
      setPendingReplySessionId(sessionId);
      setStreamingText("");
      void requestAiCustomerReplyStream(s, session, { kind: "card", cardId }, (partial) => {
        setStreamingText(partial);
      })
        .then((aiReactionLine) => {
          if (stateRef.current.runId !== runId) return;
          setStreamingText(undefined);
          dispatch({ type: "CHOOSE_REPLY", cardId, sessionId, aiReactionLine });
        })
        .finally(() => {
          setStreamingText(undefined);
          setPendingReplySessionId((currentId) => (currentId === sessionId ? undefined : currentId));
        });
    },
    [pendingReplySessionId],
  );
  const handleSubmitFreeReply = useCallback(
    (text: string) => {
      const s = stateRef.current;
      const session = getActiveSession(s);

      if (s.phase !== "player_reply" || !session || session.status !== "active" || pendingReplySessionId) {
        return;
      }

      const sessionId = session.id;
      const runId = s.runId;
      dispatch({ type: "ADD_AGENT_MESSAGE", text, sessionId });
      setPendingReplySessionId(sessionId);
      setStreamingText("");
      void requestAiCustomerReplyStream(s, session, { kind: "free", text }, (partial) => {
        setStreamingText(partial);
      })
        .then((aiReactionLine) => {
          if (stateRef.current.runId !== runId) return;
          setStreamingText(undefined);
          dispatch({ type: "SUBMIT_FREE_REPLY", text, sessionId, aiReactionLine });
        })
        .finally(() => {
          setStreamingText(undefined);
          setPendingReplySessionId((currentId) => (currentId === sessionId ? undefined : currentId));
        });
    },
    [pendingReplySessionId],
  );
  const handleRetry = useCallback(() => {
    recordedSummaryRef.current = undefined;
    dispatch({
      type: "RESTART_DAY",
      level: buildLevelConfig(currentDay, currentSupportMode, meta.unlockedCardIds),
      seed: Date.now(),
    });
  }, [currentDay, currentSupportMode, meta.unlockedCardIds]);
  const handleAdvance = useCallback(() => {
    const nextDayId = getNextDayId(currentDayId, currentSupportMode);

    if (nextDayId) {
      enterDay(nextDayId);
    } else {
      setView("career_map");
    }
  }, [currentDayId, currentSupportMode, enterDay]);
  const handleBackToMap = useCallback(() => setView("career_map"), []);
  const handleResetCareer = useCallback(() => {
    if (window.confirm("确定要重置全部客服模式进度吗？解锁与最佳评级都会清空。")) {
      knownUnlockedRef.current = new Set();
      setNewlyUnlockedCards([]);
      resetCareer();
      setView("mode_select");
    }
  }, [resetCareer]);

  const careerMapDays = useMemo<CareerMapDay[]>(
    () =>
      currentSupportMode.days.map((day) => ({
        day,
        unlocked: unlockedDayIds.includes(day.id),
        bestGrade: bestGrades[day.id],
        isCurrent: day.id === currentDayId,
      })),
    [currentSupportMode.days, unlockedDayIds, bestGrades, currentDayId],
  );

  const passed =
    state.phase === "summary" && state.summary
      ? isPassingGrade(state.summary.grade, currentDay.passGrade)
      : false;
  const hasNextDay = Boolean(getNextDayId(currentDayId, currentSupportMode));

  if (activeSimulator === "hub") {
    return (
      <SimulatorHub
        unlockedDays={unlockedSupportDays}
        totalDays={totalSupportDays}
        gradedDays={gradedSupportDays}
        onLaunchSupport={launchSupportSimulator}
        onLaunchInterview={launchInterviewSimulator}
        onLaunchShiftRoster={launchShiftRosterSimulator}
        onLaunchClinicTriage={launchClinicTriageSimulator}
        onLaunchSlacker={launchSlackerSimulator}
        user={user ?? null}
        authLoading={authLoading}
        onLogin={login}
        onLogout={logout}
      />
    );
  }

  if (activeSimulator === "interview") {
    return <InterviewSimulator onBackToHub={backToHub} />;
  }

  if (activeSimulator === "shiftRoster") {
    return <ShiftRosterSimulator onBackToHub={backToHub} />;
  }

  if (activeSimulator === "clinicTriage") {
    return <ClinicTriageSimulator onBackToHub={backToHub} />;
  }

  if (activeSimulator === "slacker") {
    return <SlackerMoment user={user ?? null} onBackToHub={backToHub} />;
  }

  return (
    <Layout
      onBackToHub={backToHub}
      eyebrow={currentSupportMode.headerEyebrow}
      title={currentSupportMode.headerTitle}
      shiftBadge={currentSupportMode.shiftBadge}
      accent={currentSupportMode.accent}
      onSwitchSupportMode={handleSwitchSupportMode}
      metrics={<MetricsBar metrics={visibleMetrics} phase={state.phase} />}
      chat={
        view === "mode_select" ? (
          <SupportModeSelect
            modes={supportModeList}
            progressByMode={supportModeProgressByMode}
            onSelectMode={handleSelectSupportMode}
          />
        ) : view === "career_map" ? (
          <CareerMap
            days={careerMapDays}
            title={currentSupportMode.mapTitle}
            intro={currentSupportMode.mapIntro}
            onSelectDay={enterDay}
            onResetCareer={handleResetCareer}
          />
        ) : (
          <ChatPanel
            activeSession={activeSession}
            sessions={state.sessions}
            shiftMessages={state.shiftMessages}
            phase={state.phase}
            streamingText={streamingText}
            onStart={handleStart}
            onSelectSession={handleSelectSession}
          />
        )
      }
      status={<CustomerStatus customer={activeCustomer} session={activeSession} />}
      achievements={
        <AchievementsPanel unlockedIds={state.achievements} stats={state.achievementStats} />
      }
      knowledge={
        <KnowledgeBase
          policies={
            view === "shift" ? activeLevel.policies : currentSupportMode.policies
          }
        />
      }
      replies={
        view === "shift" && state.phase === "summary" ? (
          <DaySummary
            summary={state.summary}
            sessions={state.sessions}
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
