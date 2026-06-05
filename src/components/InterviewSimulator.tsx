import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Eye,
  FileSearch,
  HelpCircle,
  History,
  MessageSquareText,
  Play,
  RotateCcw,
  Scale,
  Sparkles,
  ThumbsDown,
  TimerReset,
  UserRound,
  Users,
} from "lucide-react";
import {
  decisionLabels,
  difficultySettings,
  getCandidatesForRole,
  interviewQuestions,
  interviewRoles,
} from "../interview/content";
import {
  buildDecisionRecord,
  buildInterviewSummary,
  createHistoryRecord,
  getAskedCoverage,
  getQuestionById,
  getSignalSummary,
  mergeInterviewMetrics,
  metricLabels,
} from "../interview/engine";
import type {
  Candidate,
  CandidateSignal,
  HiringDecision,
  InterviewDecisionRecord,
  InterviewDifficulty,
  InterviewHistoryRecord,
  InterviewMetricKey,
  InterviewRoleId,
  InterviewStage,
  InterviewSummary,
  QuestionId,
} from "../interview/types";

const historyStorageKey = "simulator-box.interviewer-game-history.v1";

interface InterviewSimulatorProps {
  onBackToHub: () => void;
}

const decisionIcons: Record<HiringDecision, typeof CheckCircle2> = {
  hire: CheckCircle2,
  waitlist: Scale,
  reject: ThumbsDown,
};

export function InterviewSimulator({ onBackToHub }: InterviewSimulatorProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<InterviewRoleId>("frontend");
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>("steady");
  const [stage, setStage] = useState<InterviewStage>("setup");
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [askedByCandidate, setAskedByCandidate] = useState<Record<string, QuestionId[]>>({});
  const [selectedQuestionId, setSelectedQuestionId] = useState<QuestionId>("impact");
  const [records, setRecords] = useState<InterviewDecisionRecord[]>([]);
  const [latestRecord, setLatestRecord] = useState<InterviewDecisionRecord>();
  const [summary, setSummary] = useState<InterviewSummary>();
  const [history, setHistory] = useState<InterviewHistoryRecord[]>(() => loadHistory());

  const role = interviewRoles.find((item) => item.id === selectedRoleId) ?? interviewRoles[0];
  const difficultySetting = difficultySettings[difficulty];
  const roleCandidates = useMemo(() => getCandidatesForRole(selectedRoleId), [selectedRoleId]);
  const activeCandidate = roleCandidates[candidateIndex] ?? roleCandidates[0];
  const askedQuestionIds = activeCandidate ? askedByCandidate[activeCandidate.id] ?? [] : [];
  const remainingQuestions = Math.max(0, difficultySetting.questionLimit - askedQuestionIds.length);
  const metrics = summary?.metrics ?? mergeInterviewMetrics(records);
  const progress = Math.round((records.length / Math.max(1, roleCandidates.length)) * 100);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  useEffect(() => {
    setCandidateIndex(0);
    setAskedByCandidate({});
    setRecords([]);
    setLatestRecord(undefined);
    setSummary(undefined);
    setSelectedQuestionId("impact");
    setStage("setup");
  }, [selectedRoleId]);

  const startRound = useCallback(() => {
    setCandidateIndex(0);
    setAskedByCandidate({});
    setRecords([]);
    setLatestRecord(undefined);
    setSummary(undefined);
    setSelectedQuestionId("impact");
    setStage("shortlist");
  }, []);

  const enterInterview = useCallback(() => {
    setLatestRecord(undefined);
    setStage("interview");
  }, []);

  const askQuestion = useCallback(
    (questionId: QuestionId) => {
      if (!activeCandidate || askedQuestionIds.includes(questionId) || remainingQuestions <= 0) {
        return;
      }

      setAskedByCandidate((prev) => ({
        ...prev,
        [activeCandidate.id]: [...(prev[activeCandidate.id] ?? []), questionId],
      }));
      setSelectedQuestionId(questionId);
    },
    [activeCandidate, askedQuestionIds, remainingQuestions],
  );

  const enterDecision = useCallback(() => {
    if (!activeCandidate) {
      return;
    }

    setStage("decision");
  }, [activeCandidate]);

  const decideCandidate = useCallback(
    (decision: HiringDecision) => {
      if (!activeCandidate) {
        return;
      }

      const nextRecord = buildDecisionRecord({
        candidate: activeCandidate,
        role,
        difficulty,
        decision,
        askedQuestionIds,
      });
      const nextRecords = [...records, nextRecord];
      setRecords(nextRecords);
      setLatestRecord(nextRecord);

      if (candidateIndex >= roleCandidates.length - 1) {
        const nextSummary = buildInterviewSummary(nextRecords, role, difficulty);
        setSummary(nextSummary);
        setHistory((prev) => [createHistoryRecord(nextSummary, role), ...prev].slice(0, 8));
      }

      setStage("outcome");
    },
    [activeCandidate, askedQuestionIds, candidateIndex, difficulty, records, role, roleCandidates.length],
  );

  const nextCandidate = useCallback(() => {
    if (candidateIndex >= roleCandidates.length - 1) {
      setStage("summary");
      return;
    }

    setCandidateIndex((index) => index + 1);
    setSelectedQuestionId("impact");
    setLatestRecord(undefined);
    setStage("shortlist");
  }, [candidateIndex, roleCandidates.length]);

  const resetRound = useCallback(() => {
    setCandidateIndex(0);
    setAskedByCandidate({});
    setRecords([]);
    setLatestRecord(undefined);
    setSummary(undefined);
    setSelectedQuestionId("impact");
    setStage("setup");
  }, []);

  return (
    <main className="interview-shell">
      <header className="interview-topbar">
        <div>
          <p className="eyebrow">Simulator Box / Hiring Desk</p>
          <h1>面试官游戏</h1>
        </div>
        <div className="topbar-actions">
          <button className="hub-back-button" type="button" onClick={onBackToHub}>
            <ChevronLeft size={17} aria-hidden="true" />
            模拟器盒子
          </button>
          <div className="shift-badge">
            <BriefcaseBusiness size={15} aria-hidden="true" />
            {role.title} / {difficultySetting.label}
          </div>
        </div>
      </header>

      <InterviewMetricsBar metrics={metrics} progress={progress} stage={stage} />

      <section className="interview-workspace">
        <section className="interview-main panel">
          <InterviewPanelHeader roleTitle={role.title} stage={stage} />

          {stage === "setup" ? (
            <InterviewSetup
              difficulty={difficulty}
              onDifficultyChange={setDifficulty}
              onRoleChange={setSelectedRoleId}
              onStart={startRound}
              selectedRoleId={selectedRoleId}
            />
          ) : null}

          {stage === "shortlist" && activeCandidate ? (
            <CandidateBriefing
              candidate={activeCandidate}
              candidateIndex={candidateIndex}
              candidateTotal={roleCandidates.length}
              onStart={enterInterview}
              roleTitle={role.title}
            />
          ) : null}

          {stage === "interview" && activeCandidate ? (
            <InterviewDesk
              askedQuestionIds={askedQuestionIds}
              candidate={activeCandidate}
              onAskQuestion={askQuestion}
              onDecision={enterDecision}
              questionLimit={difficultySetting.questionLimit}
              remainingQuestions={remainingQuestions}
              selectedQuestionId={selectedQuestionId}
            />
          ) : null}

          {stage === "decision" && activeCandidate ? (
            <DecisionPanel
              askedQuestionIds={askedQuestionIds}
              candidate={activeCandidate}
              onBack={() => setStage("interview")}
              onDecide={decideCandidate}
            />
          ) : null}

          {stage === "outcome" && latestRecord ? (
            <OutcomePanel
              isFinalCandidate={candidateIndex >= roleCandidates.length - 1}
              onNext={nextCandidate}
              record={latestRecord}
            />
          ) : null}

          {stage === "summary" && summary ? (
            <InterviewSummaryView onRestart={resetRound} onTryAgain={startRound} summary={summary} />
          ) : null}
        </section>

        <aside className="interview-side">
          <RoleBriefCard roleId={selectedRoleId} />
          <HiringQueueCard
            activeCandidateId={activeCandidate?.id}
            candidates={roleCandidates}
            records={records}
          />
          <QuestionGuideCard />
          <HistoryCard history={history} />
        </aside>
      </section>
    </main>
  );
}

function InterviewMetricsBar({
  metrics,
  progress,
  stage,
}: {
  metrics: Record<InterviewMetricKey, number>;
  progress: number;
  stage: InterviewStage;
}) {
  const items: Array<{ key: InterviewMetricKey; icon: typeof BadgeCheck; tone: string }> = [
    { key: "accuracy", icon: BadgeCheck, tone: "positive" },
    { key: "evidence", icon: ClipboardCheck, tone: "time" },
    { key: "candidateExperience", icon: UserRound, tone: "cost" },
    { key: "biasControl", icon: Scale, tone: "warning" },
    { key: "teamFit", icon: Users, tone: "danger" },
  ];

  return (
    <section className="metrics-bar interview-metrics" aria-label="面试官指标">
      {items.map((item) => {
        const Icon = item.icon;
        const value = metrics[item.key];

        return (
          <div className={`metric metric-${item.tone}`} key={item.key}>
            <div className="metric-heading">
              <Icon size={18} aria-hidden="true" />
              <span>{metricLabels[item.key]}</span>
            </div>
            <strong>{value}</strong>
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${value}%` }} />
            </div>
          </div>
        );
      })}
      <div className="metric phase-indicator">
        <span>流程进度</span>
        <strong>{stage === "summary" ? "完成" : `${progress}%`}</strong>
      </div>
    </section>
  );
}

function InterviewPanelHeader({ roleTitle, stage }: { roleTitle: string; stage: InterviewStage }) {
  return (
    <div className="panel-header interview-panel-header">
      <div>
        <p className="eyebrow">{getStageLabel(stage)}</p>
        <h2>{roleTitle}招聘桌</h2>
        <span>看简历、问问题、识别信号，然后承担判断后果。</span>
      </div>
      <div className="interviewer-avatar" aria-hidden="true">
        <FileSearch size={25} />
      </div>
    </div>
  );
}

function InterviewSetup({
  difficulty,
  onDifficultyChange,
  onRoleChange,
  onStart,
  selectedRoleId,
}: {
  difficulty: InterviewDifficulty;
  onDifficultyChange: (value: InterviewDifficulty) => void;
  onRoleChange: (value: InterviewRoleId) => void;
  onStart: () => void;
  selectedRoleId: InterviewRoleId;
}) {
  return (
    <div className="interview-setup">
      <div className="interview-selector-block">
        <div className="interview-section-title">
          <BriefcaseBusiness size={18} aria-hidden="true" />
          <h3>选择招聘岗位</h3>
        </div>
        <div className="interview-option-grid">
          {interviewRoles.map((role) => (
            <button
              className={`interview-option ${role.id === selectedRoleId ? "interview-option-active" : ""}`}
              key={role.id}
              type="button"
              onClick={() => onRoleChange(role.id)}
            >
              <strong>{role.title}</strong>
              <span>{role.hiringGoal}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="interview-selector-block">
        <div className="interview-section-title">
          <TimerReset size={18} aria-hidden="true" />
          <h3>选择面试压力</h3>
        </div>
        <div className="difficulty-card-grid">
          {(Object.keys(difficultySettings) as InterviewDifficulty[]).map((item) => {
            const setting = difficultySettings[item];

            return (
              <button
                className={`difficulty-card ${item === difficulty ? "difficulty-card-active" : ""}`}
                key={item}
                type="button"
                onClick={() => onDifficultyChange(item)}
              >
                <span>{setting.pressureLabel}</span>
                <strong>{setting.label}</strong>
                <small>{setting.description}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="interview-rules-strip">
        <article>
          <Eye size={18} aria-hidden="true" />
          <strong>看穿表层表现</strong>
          <span>候选人会有表达、履历和真实能力之间的错位。</span>
        </article>
        <article>
          <MessageSquareText size={18} aria-hidden="true" />
          <strong>有限提问</strong>
          <span>每个问题都会影响证据完整度、体验和偏见风险。</span>
        </article>
        <article>
          <BarChart3 size={18} aria-hidden="true" />
          <strong>延迟反馈</strong>
          <span>录用、待定或淘汰后，系统会展示后续团队结果。</span>
        </article>
      </div>

      <div className="interview-start-row">
        <button className="primary-button interview-start-button" type="button" onClick={onStart}>
          <Play size={18} aria-hidden="true" />
          开始筛选
        </button>
      </div>
    </div>
  );
}

function CandidateBriefing({
  candidate,
  candidateIndex,
  candidateTotal,
  onStart,
  roleTitle,
}: {
  candidate: Candidate;
  candidateIndex: number;
  candidateTotal: number;
  onStart: () => void;
  roleTitle: string;
}) {
  return (
    <div className="candidate-briefing">
      <div className="candidate-cover">
        <div className="candidate-avatar-large">{candidate.initials}</div>
        <div>
          <p className="eyebrow">
            候选人 {candidateIndex + 1}/{candidateTotal} / {roleTitle}
          </p>
          <h2>{candidate.name}</h2>
          <span>{candidate.headline}</span>
        </div>
      </div>

      <div className="resume-board">
        <article>
          <strong>简历摘要</strong>
          <p>{candidate.resumeSummary}</p>
        </article>
        <article>
          <strong>可见标签</strong>
          <div className="tag-row">
            {candidate.surfaceTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </article>
      </div>

      <div className="candidate-readout-grid">
        <Readout label="表达表现" value={candidate.expression} />
        <Readout label="履历光环" value={candidate.pedigree} />
        <Readout label="期望薪资" text={candidate.expectedSalary} />
        <Readout label="到岗时间" text={candidate.availability} />
      </div>

      <div className="resume-highlights">
        {candidate.resumeHighlights.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      <button className="primary-button interview-start-button" type="button" onClick={onStart}>
        <MessageSquareText size={18} aria-hidden="true" />
        进入面试
      </button>
    </div>
  );
}

function InterviewDesk({
  askedQuestionIds,
  candidate,
  onAskQuestion,
  onDecision,
  questionLimit,
  remainingQuestions,
  selectedQuestionId,
}: {
  askedQuestionIds: QuestionId[];
  candidate: Candidate;
  onAskQuestion: (questionId: QuestionId) => void;
  onDecision: () => void;
  questionLimit: number;
  remainingQuestions: number;
  selectedQuestionId: QuestionId;
}) {
  const selectedQuestion = getQuestionById(selectedQuestionId);
  const response = askedQuestionIds.includes(selectedQuestionId)
    ? candidate.responses[selectedQuestionId]
    : undefined;
  const allSignals = askedQuestionIds.flatMap((questionId) => candidate.responses[questionId].signals);
  const signalSummary = getSignalSummary(allSignals);
  const canDecide = askedQuestionIds.length >= 2 || remainingQuestions === 0;

  return (
    <div className="interview-desk">
      <div className="interview-desk-main">
        <div className="interview-question-board">
          <div className="interview-board-heading">
            <div>
              <p className="eyebrow">选择提问</p>
              <h3>
                剩余 {remainingQuestions}/{questionLimit} 问
              </h3>
            </div>
            <div className="signal-mini-row">
              <span className="signal-positive">+{signalSummary.positives}</span>
              <span className="signal-warning">!{signalSummary.warnings}</span>
            </div>
          </div>
          <div className="question-card-list">
            {interviewQuestions.map((question) => {
              const asked = askedQuestionIds.includes(question.id);
              const selected = question.id === selectedQuestionId;

              return (
                <button
                  className={`question-card ${selected ? "question-card-selected" : ""} ${
                    asked ? "question-card-asked" : ""
                  }`}
                  disabled={asked || remainingQuestions <= 0}
                  key={question.id}
                  type="button"
                  onClick={() => onAskQuestion(question.id)}
                >
                  <span>{question.category}</span>
                  <strong>{question.title}</strong>
                  <small>{question.intent}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="interview-transcript hiring-transcript">
          <div className="interview-message interview-message-interviewer">
            <div className="message-copy">
              <span className="message-speaker">{selectedQuestion.title}</span>
              <p>{selectedQuestion.prompt}</p>
            </div>
          </div>

          {response ? (
            <>
              <div className="interview-message interview-message-player">
                <div className="message-copy">
                  <span className="message-speaker">{candidate.name}</span>
                  <p>{response.answer}</p>
                </div>
              </div>
              <div className="interview-feedback-strip">
                <strong>面试官笔记</strong>
                <span>{response.read}</span>
              </div>
              <SignalList signals={response.signals} />
            </>
          ) : (
            <div className="empty-question-state">
              <HelpCircle size={28} aria-hidden="true" />
              <strong>还没有问出这道题</strong>
              <span>从左侧选择问题后，候选人的回答和可见信号会出现在这里。</span>
            </div>
          )}
        </div>
      </div>

      <div className="interview-answer-actions">
        <span>已问 {askedQuestionIds.length} 道，至少 2 道后可以做判断</span>
        <button className="primary-button" disabled={!canDecide} type="button" onClick={onDecision}>
          <Scale size={17} aria-hidden="true" />
          做招聘判断
        </button>
      </div>
    </div>
  );
}

function DecisionPanel({
  askedQuestionIds,
  candidate,
  onBack,
  onDecide,
}: {
  askedQuestionIds: QuestionId[];
  candidate: Candidate;
  onBack: () => void;
  onDecide: (decision: HiringDecision) => void;
}) {
  const allSignals = askedQuestionIds.flatMap((questionId) => candidate.responses[questionId].signals);
  const coverage = getAskedCoverage(askedQuestionIds);
  const decisions: Array<{ id: HiringDecision; title: string; copy: string }> = [
    { id: "hire", title: "录用", copy: "相信候选人能在当前团队创造价值，同时承担误招成本。" },
    { id: "waitlist", title: "待定", copy: "保留候选人，要求补充证据或等待团队需求更明确。" },
    { id: "reject", title: "淘汰", copy: "认为候选人不适合当前岗位，承担错过人才的风险。" },
  ];

  return (
    <div className="decision-panel">
      <div className="decision-header-card">
        <div className="candidate-avatar-large">{candidate.initials}</div>
        <div>
          <p className="eyebrow">最终判断</p>
          <h2>{candidate.name}</h2>
          <span>{candidate.headline}</span>
        </div>
      </div>

      <div className="decision-evidence-grid">
        <CoveragePill active={coverage.hasEvidence} label="成果证据" />
        <CoveragePill active={coverage.hasTeam} label="协作方式" />
        <CoveragePill active={coverage.hasMotivation} label="动机匹配" />
        <CoveragePill active={coverage.hasPressure} label="压力复盘" />
        <CoveragePill active={!coverage.hasPedigree} label="少看光环" />
      </div>

      <SignalList signals={allSignals} />

      <div className="decision-choice-grid">
        {decisions.map((decision) => {
          const Icon = decisionIcons[decision.id];

          return (
            <button
              className={`decision-choice decision-choice-${decision.id}`}
              key={decision.id}
              type="button"
              onClick={() => onDecide(decision.id)}
            >
              <Icon size={22} aria-hidden="true" />
              <strong>{decision.title}</strong>
              <span>{decision.copy}</span>
            </button>
          );
        })}
      </div>

      <div className="summary-actions">
        <button className="secondary-button" type="button" onClick={onBack}>
          继续提问
        </button>
      </div>
    </div>
  );
}

function OutcomePanel({
  isFinalCandidate,
  onNext,
  record,
}: {
  isFinalCandidate: boolean;
  onNext: () => void;
  record: InterviewDecisionRecord;
}) {
  return (
    <div className="outcome-panel">
      <div className="interview-score-card">
        <div className="interview-score-ring">
          <span>{record.decisionScore}</span>
          <small>判断分</small>
        </div>
        <div>
          <p className="eyebrow">{decisionLabels[record.decision]} / 推荐 {decisionLabels[record.recommendedDecision]}</p>
          <h2>{record.verdict}</h2>
        </div>
      </div>

      <div className="outcome-feedback-card">
        <strong>延迟后果</strong>
        <p>{record.delayedFeedback}</p>
      </div>

      {record.blindSpots.length > 0 ? (
        <div className="interview-review-list">
          <h3>这轮盲区</h3>
          {record.blindSpots.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      ) : null}

      <div className="interview-summary-grid">
        <MetricArticle label="证据完整" value={record.evidenceScore} />
        <MetricArticle label="候选人体验" value={record.candidateExperience} />
        <MetricArticle label="偏见控制" value={record.biasControl} />
        <MetricArticle label="团队匹配" value={record.teamFit} />
      </div>

      <div className="summary-actions">
        <button className="primary-button" type="button" onClick={onNext}>
          {isFinalCandidate ? "查看整轮复盘" : "下一位候选人"}
        </button>
      </div>
    </div>
  );
}

function InterviewSummaryView({
  onRestart,
  onTryAgain,
  summary,
}: {
  onRestart: () => void;
  onTryAgain: () => void;
  summary: InterviewSummary;
}) {
  return (
    <div className="interview-summary-view">
      <div className="interview-score-card">
        <div className="interview-score-ring">
          <span>{summary.totalScore}</span>
          <small>总分</small>
        </div>
        <div>
          <p className="eyebrow">{summary.hireSignal}</p>
          <h2>{summary.verdict}</h2>
        </div>
      </div>

      <div className="interview-summary-grid">
        <MetricArticle label="判断准确" value={summary.metrics.accuracy} />
        <MetricArticle label="证据完整" value={summary.metrics.evidence} />
        <MetricArticle label="偏见控制" value={summary.metrics.biasControl} />
        <MetricArticle label="最佳候选" text={summary.bestCandidateName} />
      </div>

      <div className="interview-review-list">
        <h3>下一轮建议</h3>
        {summary.suggestions.map((suggestion) => (
          <p key={suggestion}>{suggestion}</p>
        ))}
      </div>

      <div className="interview-answer-review">
        {summary.records.map((record) => (
          <details key={record.id} open={record.candidateId === summary.bestCandidateId}>
            <summary>
              {record.candidateName} / 你的判断：{decisionLabels[record.decision]} / 推荐：
              {decisionLabels[record.recommendedDecision]}
            </summary>
            <p>{record.verdict}</p>
            <p>{record.delayedFeedback}</p>
            <div className="answer-review-tags">
              <span className="review-good">判断 {record.decisionScore}</span>
              <span className="review-good">证据 {record.evidenceScore}</span>
              <span className="review-risk">偏见控制 {record.biasControl}</span>
            </div>
          </details>
        ))}
      </div>

      <div className="summary-actions">
        <button className="primary-button" type="button" onClick={onTryAgain}>
          <RotateCcw size={17} aria-hidden="true" />
          同配置再玩一轮
        </button>
        <button className="secondary-button" type="button" onClick={onRestart}>
          重新选择岗位
        </button>
      </div>
    </div>
  );
}

function RoleBriefCard({ roleId }: { roleId: InterviewRoleId }) {
  const role = interviewRoles.find((item) => item.id === roleId) ?? interviewRoles[0];

  return (
    <section className="panel interview-info-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{role.field}</p>
          <h2>{role.title}</h2>
        </div>
        <BriefcaseBusiness size={20} aria-hidden="true" />
      </div>
      <p>{role.teamContext}</p>
      <div className="tag-row">
        {role.mustHaves.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </section>
  );
}

function HiringQueueCard({
  activeCandidateId,
  candidates,
  records,
}: {
  activeCandidateId?: string;
  candidates: Candidate[];
  records: InterviewDecisionRecord[];
}) {
  const recordByCandidateId = new Map(records.map((record) => [record.candidateId, record]));

  return (
    <section className="panel interview-info-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">候选人队列</p>
          <h2>本轮名单</h2>
        </div>
        <Users size={20} aria-hidden="true" />
      </div>
      <div className="candidate-queue-list">
        {candidates.map((candidate) => {
          const record = recordByCandidateId.get(candidate.id);

          return (
            <article
              className={candidate.id === activeCandidateId ? "candidate-queue-active" : ""}
              key={candidate.id}
            >
              <span>{candidate.initials}</span>
              <div>
                <strong>{candidate.name}</strong>
                <small>{record ? decisionLabels[record.decision] : candidate.headline}</small>
              </div>
              {record ? <em>{record.decisionScore}</em> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function QuestionGuideCard() {
  return (
    <section className="panel interview-info-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">提问策略</p>
          <h2>信号地图</h2>
        </div>
        <Sparkles size={20} aria-hidden="true" />
      </div>
      <div className="question-guide-list">
        {interviewQuestions.slice(0, 5).map((question) => (
          <article key={question.id}>
            <strong>{question.title}</strong>
            <span>{question.intent}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function HistoryCard({ history }: { history: InterviewHistoryRecord[] }) {
  return (
    <section className="panel interview-info-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">历史记录</p>
          <h2>最近回合</h2>
        </div>
        <History size={20} aria-hidden="true" />
      </div>
      {history.length === 0 ? (
        <p>完成第一轮招聘判断后，这里会保存最近成绩。</p>
      ) : (
        <div className="interview-history-list">
          {history.map((record) => (
            <article key={record.id}>
              <strong>{record.roleTitle}</strong>
              <span>
                {record.verdict} / 准确 {record.accuracy}
              </span>
              <em>{record.score}</em>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SignalList({ signals }: { signals: CandidateSignal[] }) {
  if (signals.length === 0) {
    return null;
  }

  return (
    <div className="signal-list">
      {signals.map((signal) => (
        <span className={`candidate-signal candidate-signal-${signal.tone}`} key={signal.label}>
          {signal.label}
        </span>
      ))}
    </div>
  );
}

function Readout({ label, text, value }: { label: string; text?: string; value?: number }) {
  return (
    <article className="candidate-readout">
      <span>{label}</span>
      <strong>{text ?? value}</strong>
      {typeof value === "number" ? (
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${value}%` }} />
        </div>
      ) : null}
    </article>
  );
}

function CoveragePill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={active ? "coverage-pill coverage-pill-active" : "coverage-pill"}>
      {active ? <CheckCircle2 size={15} aria-hidden="true" /> : <HelpCircle size={15} aria-hidden="true" />}
      {label}
    </span>
  );
}

function MetricArticle({ label, text, value }: { label: string; text?: string; value?: number }) {
  return (
    <article>
      <strong>{label}</strong>
      <span>{text ?? value}</span>
    </article>
  );
}

function getStageLabel(stage: InterviewStage) {
  switch (stage) {
    case "setup":
      return "配置招聘";
    case "shortlist":
      return "阅读简历";
    case "interview":
      return "正在面试";
    case "decision":
      return "招聘判断";
    case "outcome":
      return "后续反馈";
    case "summary":
      return "整轮复盘";
  }
}

function loadHistory(): InterviewHistoryRecord[] {
  try {
    const raw = window.localStorage.getItem(historyStorageKey);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as InterviewHistoryRecord[];

    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: InterviewHistoryRecord[]) {
  window.localStorage.setItem(historyStorageKey, JSON.stringify(history));
}
