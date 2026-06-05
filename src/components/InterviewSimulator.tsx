import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  ChevronLeft,
  ClipboardList,
  FileText,
  History,
  MessageSquareText,
  MicVocal,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UserRound,
} from "lucide-react";
import {
  buildCustomInterviewInsight,
  difficultyDescriptions,
  difficultyLabels,
  getInterviewQuestions,
  interviewRoles,
  interviewers,
} from "../interview/content";
import {
  buildRetryComparison,
  buildInterviewSummary,
  createHistoryRecord,
  mergeInterviewMetrics,
  scoreInterviewAnswer,
} from "../interview/engine";
import type {
  CustomInterviewInsight,
  InterviewAnswer,
  InterviewCustomization,
  InterviewDifficulty,
  InterviewHistoryRecord,
  InterviewerId,
  InterviewMetricKey,
  InterviewQuestion,
  InterviewRoleId,
  InterviewStage,
  InterviewSummary,
} from "../interview/types";

const historyStorageKey = "simulator-box.interview-history.v1";

const metricLabels: Record<InterviewMetricKey, string> = {
  clarity: "表达清晰",
  structure: "逻辑结构",
  evidence: "案例证据",
  roleFit: "岗位匹配",
  resilience: "抗压表现",
};

interface InterviewSimulatorProps {
  onBackToHub: () => void;
}

export function InterviewSimulator({ onBackToHub }: InterviewSimulatorProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<InterviewRoleId>("frontend");
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>("mid");
  const [interviewerId, setInterviewerId] = useState<InterviewerId>("chen");
  const [stage, setStage] = useState<InterviewStage>("setup");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [draft, setDraft] = useState("");
  const [jdText, setJdText] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [retryDrafts, setRetryDrafts] = useState<Record<number, string>>({});
  const [retryAnswers, setRetryAnswers] = useState<Record<number, InterviewAnswer>>({});
  const [summary, setSummary] = useState<InterviewSummary>();
  const [history, setHistory] = useState<InterviewHistoryRecord[]>(() => loadHistory());

  const role = interviewRoles.find((item) => item.id === selectedRoleId) ?? interviewRoles[0];
  const interviewer = interviewers.find((item) => item.id === interviewerId) ?? interviewers[0];
  const customization = useMemo<InterviewCustomization>(
    () => ({ jdText, resumeText }),
    [jdText, resumeText],
  );
  const customInsight = useMemo(
    () => buildCustomInterviewInsight(role, customization),
    [customization, role],
  );
  const questions = useMemo(
    () => getInterviewQuestions(role, difficulty, customization),
    [customization, difficulty, role],
  );
  const activeQuestion = questions[questionIndex];
  const metrics = summary?.metrics ?? mergeInterviewMetrics(answers);
  const progress = Math.round((answers.length / questions.length) * 100);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const startInterview = useCallback(() => {
    setStage("briefing");
    setQuestionIndex(0);
    setAnswers([]);
    setSummary(undefined);
    setDraft("");
    setRetryDrafts({});
    setRetryAnswers({});
  }, []);

  const enterFirstQuestion = useCallback(() => {
    setStage("question");
  }, []);

  const resetInterview = useCallback(() => {
    setStage("setup");
    setQuestionIndex(0);
    setAnswers([]);
    setSummary(undefined);
    setDraft("");
    setRetryDrafts({});
    setRetryAnswers({});
  }, []);

  const submitAnswer = useCallback(() => {
    const trimmed = draft.trim();

    if (!trimmed || !activeQuestion) {
      return;
    }

    const scored = scoreInterviewAnswer(
      trimmed,
      activeQuestion,
      role,
      difficulty,
      interviewer,
      undefined,
      customization,
    );
    const nextAnswers = [...answers, scored];
    setAnswers(nextAnswers);
    setDraft("");

    if (questionIndex >= questions.length - 1) {
      const nextSummary = buildInterviewSummary(nextAnswers, role, difficulty, interviewer, customization);
      setSummary(nextSummary);
      setHistory((prev) => [
        createHistoryRecord(nextSummary, role, difficulty, interviewer),
        ...prev,
      ].slice(0, 8));
      setStage("summary");
      return;
    }

    setQuestionIndex((index) => index + 1);
  }, [
    activeQuestion,
    answers,
    customization,
    difficulty,
    draft,
    interviewer,
    questionIndex,
    questions.length,
    role,
  ]);

  const submitRetryAnswer = useCallback(
    (answerIndex: number) => {
      const trimmed = (retryDrafts[answerIndex] ?? "").trim();
      const originalAnswer = answers[answerIndex];
      const question = questions.find((item) => item.id === originalAnswer?.questionId);

      if (!trimmed || !originalAnswer || !question) {
        return;
      }

      const retryAnswer = scoreInterviewAnswer(
        trimmed,
        question,
        role,
        difficulty,
        interviewer,
        originalAnswer,
        customization,
      );

      setRetryAnswers((prev) => ({ ...prev, [answerIndex]: retryAnswer }));
    },
    [answers, customization, difficulty, interviewer, questions, retryDrafts, role],
  );

  const latestAnswer = answers[answers.length - 1];

  return (
    <main className="interview-shell">
      <header className="interview-topbar">
        <div>
          <p className="eyebrow">Simulator Box · Interview Coach</p>
          <h1>模拟面试官</h1>
        </div>
        <div className="topbar-actions">
          <button className="hub-back-button" type="button" onClick={onBackToHub}>
            <ChevronLeft size={17} aria-hidden="true" />
            模拟器盒子
          </button>
          <div className="shift-badge">
            <MicVocal size={15} aria-hidden="true" />
            {role.title} · {difficultyLabels[difficulty]}
          </div>
        </div>
      </header>

      <InterviewMetricsBar metrics={metrics} progress={progress} stage={stage} />

      <section className="interview-workspace">
        <section className="interview-main panel">
          <InterviewPanelHeader
            interviewerInitials={interviewer.initials}
            interviewerName={interviewer.name}
            interviewerTitle={interviewer.title}
            stage={stage}
          />

          {stage === "setup" ? (
            <InterviewSetup
              difficulty={difficulty}
              interviewerId={interviewerId}
              onDifficultyChange={setDifficulty}
              onInterviewerChange={setInterviewerId}
              onJdTextChange={setJdText}
              onRoleChange={setSelectedRoleId}
              onResumeTextChange={setResumeText}
              onStart={startInterview}
              customInsight={customInsight}
              jdText={jdText}
              resumeText={resumeText}
              selectedRoleId={selectedRoleId}
            />
          ) : null}

          {stage === "briefing" ? (
            <InterviewBriefing
              difficulty={difficulty}
              interviewerName={interviewer.name}
              customInsight={customInsight}
              onStart={enterFirstQuestion}
              questions={questions}
              roleMission={role.mission}
              roleTitle={role.title}
            />
          ) : null}

          {stage === "question" && activeQuestion ? (
            <InterviewQuestionView
              answerCount={answers.length}
              draft={draft}
              latestAnswer={latestAnswer}
              onDraftChange={setDraft}
              onSubmit={submitAnswer}
              question={activeQuestion}
              questionCount={questions.length}
              questionIndex={questionIndex}
            />
          ) : null}

          {stage === "summary" && summary ? (
            <InterviewSummaryView
              answers={answers}
              onRestart={resetInterview}
              onRetryDraftChange={(answerIndex, value) =>
                setRetryDrafts((prev) => ({ ...prev, [answerIndex]: value }))
              }
              onSubmitRetry={submitRetryAnswer}
              onTryAgain={startInterview}
              retryAnswers={retryAnswers}
              retryDrafts={retryDrafts}
              summary={summary}
            />
          ) : null}
        </section>

        <aside className="interview-side">
          <RoleBriefCard roleId={selectedRoleId} />
          <InterviewerCard interviewerId={interviewerId} />
          <CustomMaterialCard insight={customInsight} />
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
    { key: "clarity", icon: BadgeCheck, tone: "positive" },
    { key: "structure", icon: BarChart3, tone: "time" },
    { key: "evidence", icon: ClipboardList, tone: "cost" },
    { key: "roleFit", icon: BriefcaseBusiness, tone: "warning" },
    { key: "resilience", icon: ShieldCheck, tone: "danger" },
  ];

  return (
    <section className="metrics-bar interview-metrics" aria-label="面试指标">
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
        <span>面试进度</span>
        <strong>{stage === "summary" ? "完成" : `${progress}%`}</strong>
      </div>
    </section>
  );
}

function InterviewPanelHeader({
  interviewerInitials,
  interviewerName,
  interviewerTitle,
  stage,
}: {
  interviewerInitials: string;
  interviewerName: string;
  interviewerTitle: string;
  stage: InterviewStage;
}) {
  return (
    <div className="panel-header interview-panel-header">
      <div>
        <p className="eyebrow">{getStageLabel(stage)}</p>
        <h2>{interviewerName}</h2>
        <span>{interviewerTitle}</span>
      </div>
      <div className="interviewer-avatar" aria-hidden="true">
        {interviewerInitials}
      </div>
    </div>
  );
}

function InterviewSetup({
  customInsight,
  difficulty,
  interviewerId,
  jdText,
  onDifficultyChange,
  onInterviewerChange,
  onJdTextChange,
  onRoleChange,
  onResumeTextChange,
  onStart,
  resumeText,
  selectedRoleId,
}: {
  customInsight: CustomInterviewInsight;
  difficulty: InterviewDifficulty;
  interviewerId: InterviewerId;
  jdText: string;
  onDifficultyChange: (value: InterviewDifficulty) => void;
  onInterviewerChange: (value: InterviewerId) => void;
  onJdTextChange: (value: string) => void;
  onRoleChange: (value: InterviewRoleId) => void;
  onResumeTextChange: (value: string) => void;
  onStart: () => void;
  resumeText: string;
  selectedRoleId: InterviewRoleId;
}) {
  return (
    <div className="interview-setup">
      <div className="interview-selector-block">
        <div className="interview-section-title">
          <BriefcaseBusiness size={18} aria-hidden="true" />
          <h3>选择目标岗位</h3>
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
              <span>{role.mission}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="interview-selector-block">
        <div className="interview-section-title">
          <FileText size={18} aria-hidden="true" />
          <h3>定制面试材料</h3>
        </div>
        <div className="custom-material-grid">
          <label>
            <span>岗位 JD</span>
            <textarea
              maxLength={1200}
              onChange={(event) => onJdTextChange(event.target.value)}
              placeholder="粘贴招聘要求、岗位职责或你想模拟的职位描述。"
              value={jdText}
            />
          </label>
          <label>
            <span>简历/项目片段</span>
            <textarea
              maxLength={1200}
              onChange={(event) => onResumeTextChange(event.target.value)}
              placeholder="粘贴你的简历摘要、项目经历或准备重点。"
              value={resumeText}
            />
          </label>
        </div>
        <div className="custom-signal-row">
          {customInsight.keywords.slice(0, 6).map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
      </div>

      <div className="interview-selector-row">
        <div className="interview-selector-block">
          <div className="interview-section-title">
            <TimerReset size={18} aria-hidden="true" />
            <h3>面试难度</h3>
          </div>
          <div className="segmented-control" aria-label="面试难度">
            {(Object.keys(difficultyLabels) as InterviewDifficulty[]).map((item) => (
              <button
                className={item === difficulty ? "segmented-active" : ""}
                key={item}
                type="button"
                onClick={() => onDifficultyChange(item)}
              >
                {difficultyLabels[item]}
              </button>
            ))}
          </div>
          <p className="interview-helper">{difficultyDescriptions[difficulty]}</p>
        </div>

        <div className="interview-selector-block">
          <div className="interview-section-title">
            <UserRound size={18} aria-hidden="true" />
            <h3>面试官</h3>
          </div>
          <div className="interviewer-choice-list">
            {interviewers.map((interviewer) => (
              <button
                className={`interviewer-choice ${
                  interviewer.id === interviewerId ? "interviewer-choice-active" : ""
                }`}
                key={interviewer.id}
                type="button"
                onClick={() => onInterviewerChange(interviewer.id)}
              >
                <span>{interviewer.initials}</span>
                <strong>{interviewer.name}</strong>
                <small>{interviewer.title}</small>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="interview-start-row">
        <button className="primary-button interview-start-button" type="button" onClick={onStart}>
          <Play size={18} aria-hidden="true" />
          开始模拟面试
        </button>
      </div>
    </div>
  );
}

function InterviewBriefing({
  customInsight,
  difficulty,
  interviewerName,
  onStart,
  questions,
  roleMission,
  roleTitle,
}: {
  customInsight: CustomInterviewInsight;
  difficulty: InterviewDifficulty;
  interviewerName: string;
  onStart: () => void;
  questions: InterviewQuestion[];
  roleMission: string;
  roleTitle: string;
}) {
  return (
    <div className="interview-briefing">
      <div className="interview-message interview-message-interviewer">
        <div className="message-copy">
          <span className="message-speaker">{interviewerName}</span>
          <p>
            我们今天面试的是{difficultyLabels[difficulty]}{roleTitle}。我会连续问 {questions.length} 道题，
            每次回答后都会记录追问点，最后给你一份复盘报告。
          </p>
        </div>
      </div>
      <div className="interview-brief-card">
        <Sparkles size={20} aria-hidden="true" />
        <div>
          <strong>本场岗位任务</strong>
          <p>{roleMission}</p>
        </div>
      </div>
      <div className="interview-question-preview">
        {questions.map((question, index) => (
          <span key={question.id}>
            {index + 1}. {question.title}
          </span>
        ))}
      </div>
      {customInsight.prompts.length > 0 ? (
        <div className="interview-custom-note">
          <FileText size={18} aria-hidden="true" />
          <span>已根据材料加入 {customInsight.prompts.length} 道定制追问。</span>
        </div>
      ) : null}
      <button className="primary-button interview-start-button" type="button" onClick={onStart}>
        <MessageSquareText size={18} aria-hidden="true" />
        进入第一题
      </button>
    </div>
  );
}

function InterviewQuestionView({
  answerCount,
  draft,
  latestAnswer,
  onDraftChange,
  onSubmit,
  question,
  questionCount,
  questionIndex,
}: {
  answerCount: number;
  draft: string;
  latestAnswer?: InterviewAnswer;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  question: InterviewQuestion;
  questionCount: number;
  questionIndex: number;
}) {
  return (
    <div className="interview-question-view">
      <div className="interview-transcript">
        {latestAnswer ? (
          <>
            <div className="interview-message interview-message-player">
              <div className="message-copy">
                <span className="message-speaker">你</span>
                <p>{latestAnswer.answer}</p>
              </div>
            </div>
            <div className="interview-feedback-strip">
              <strong>上一题得分 {latestAnswer.score}</strong>
              <span>{latestAnswer.followUp}</span>
            </div>
          </>
        ) : null}

        <div className="interview-message interview-message-interviewer">
          <div className="message-copy">
            <span className="message-speaker">
              第 {questionIndex + 1}/{questionCount} 题 · {question.title}
            </span>
            <p>{question.prompt}</p>
          </div>
        </div>
      </div>

      <div className="interview-answer-box">
        <label htmlFor="interview-answer">你的回答</label>
        <textarea
          id="interview-answer"
          maxLength={700}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="直接输入你的面试回答。建议包含背景、你的动作、结果数字和复盘。"
          value={draft}
        />
        <div className="interview-answer-actions">
          <span>{answerCount} 题已完成</span>
          <button className="primary-button" disabled={!draft.trim()} type="button" onClick={onSubmit}>
            <Send size={17} aria-hidden="true" />
            提交回答
          </button>
        </div>
      </div>
    </div>
  );
}

function InterviewSummaryView({
  answers,
  onRestart,
  onRetryDraftChange,
  onSubmitRetry,
  onTryAgain,
  retryAnswers,
  retryDrafts,
  summary,
}: {
  answers: InterviewAnswer[];
  onRestart: () => void;
  onRetryDraftChange: (answerIndex: number, value: string) => void;
  onSubmitRetry: (answerIndex: number) => void;
  onTryAgain: () => void;
  retryAnswers: Record<number, InterviewAnswer>;
  retryDrafts: Record<number, string>;
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
        <article>
          <strong>最强回答</strong>
          <span>
            {summary.strongestAnswer
              ? `${summary.strongestAnswer.prompt} · ${summary.strongestAnswer.score} 分`
              : "暂无"}
          </span>
        </article>
        <article>
          <strong>优先重练</strong>
          <span>
            {summary.weakestAnswer
              ? `${summary.weakestAnswer.prompt} · ${summary.weakestAnswer.score} 分`
              : "暂无"}
          </span>
        </article>
      </div>

      <div className="interview-review-list">
        <h3>改进建议</h3>
        {summary.suggestions.map((suggestion) => (
          <p key={suggestion}>{suggestion}</p>
        ))}
      </div>

      <div className="interview-model-answer">
        <h3>参考回答骨架</h3>
        <p>{summary.modelAnswer}</p>
      </div>

      <div className="interview-answer-review">
        {answers.map((answer, index) => (
          <details key={`${answer.questionId}-${index}`}>
            <summary>
              第 {index + 1} 题 · {answer.score} 分
            </summary>
            <p className="answer-original">{answer.answer}</p>
            <div className="answer-review-tags">
              {answer.strengths.map((item) => (
                <span className="review-good" key={item}>{item}</span>
              ))}
              {answer.risks.map((item) => (
                <span className="review-risk" key={item}>{item}</span>
              ))}
            </div>
            <div className="answer-coaching-grid">
              <article>
                <strong>面试官顾虑</strong>
                <p>{answer.concern}</p>
              </article>
              <article>
                <strong>优化回答骨架</strong>
                <p>{answer.improvedAnswer}</p>
              </article>
            </div>
            <div className="retry-challenge">
              <label htmlFor={`retry-answer-${index}`}>重答挑战</label>
              <textarea
                id={`retry-answer-${index}`}
                maxLength={700}
                onChange={(event) => onRetryDraftChange(index, event.target.value)}
                placeholder="根据上面的顾虑和骨架，再回答一次这道题。"
                value={retryDrafts[index] ?? ""}
              />
              <div className="retry-actions">
                <button
                  className="secondary-button"
                  disabled={!(retryDrafts[index] ?? "").trim()}
                  type="button"
                  onClick={() => onSubmitRetry(index)}
                >
                  评分重答
                </button>
              </div>
              {retryAnswers[index] ? (
                <RetryResult original={answer} retry={retryAnswers[index]} />
              ) : null}
            </div>
          </details>
        ))}
      </div>

      <div className="summary-actions">
        <button className="primary-button" type="button" onClick={onTryAgain}>
          <RotateCcw size={17} aria-hidden="true" />
          同配置再练一场
        </button>
        <button className="secondary-button" type="button" onClick={onRestart}>
          重新选择岗位
        </button>
      </div>
    </div>
  );
}

function RetryResult({ original, retry }: { original: InterviewAnswer; retry: InterviewAnswer }) {
  const comparison = buildRetryComparison(original, retry);

  return (
    <div className="retry-result">
      <strong>
        重答得分 {retry.score}
        {comparison.scoreDelta >= 0 ? `，提升 ${comparison.scoreDelta}` : `，下降 ${Math.abs(comparison.scoreDelta)}`}
      </strong>
      <p>{comparison.summary}</p>
      <div>
        {comparison.improvedMetrics.slice(0, 3).map((item) => (
          <span key={item.key}>
            {item.label} +{item.delta}
          </span>
        ))}
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
      <p>{role.mission}</p>
      <div className="tag-row">
        {role.competencies.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </section>
  );
}

function InterviewerCard({ interviewerId }: { interviewerId: InterviewerId }) {
  const interviewer = interviewers.find((item) => item.id === interviewerId) ?? interviewers[0];

  return (
    <section className="panel interview-info-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">面试官风格</p>
          <h2>{interviewer.name}</h2>
        </div>
        <div className="interviewer-avatar interviewer-avatar-small">{interviewer.initials}</div>
      </div>
      <p>{interviewer.style}</p>
      <div className="interviewer-pressure" aria-label={`压力等级 ${interviewer.pressure}`}>
        {Array.from({ length: 4 }, (_, index) => (
          <span className={index < interviewer.pressure ? "pressure-active" : ""} key={index} />
        ))}
      </div>
    </section>
  );
}

function CustomMaterialCard({ insight }: { insight: CustomInterviewInsight }) {
  const hasCustomPrompts = insight.prompts.length > 0;

  return (
    <section className="panel interview-info-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">定制材料</p>
          <h2>{hasCustomPrompts ? "已启用追问" : "通用面试"}</h2>
        </div>
        <FileText size={20} aria-hidden="true" />
      </div>
      <p>
        {hasCustomPrompts
          ? `已根据 JD/简历加入 ${insight.prompts.length} 道定制题。`
          : "粘贴 JD 或简历后，会自动生成更贴近你的追问。"}
      </p>
      {insight.keywords.length > 0 ? (
        <div className="tag-row">
          {insight.keywords.slice(0, 6).map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function HistoryCard({ history }: { history: InterviewHistoryRecord[] }) {
  return (
    <section className="panel interview-info-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">历史记录</p>
          <h2>最近面试</h2>
        </div>
        <History size={20} aria-hidden="true" />
      </div>
      {history.length === 0 ? (
        <p>完成第一场面试后，这里会保存最近成绩。</p>
      ) : (
        <div className="interview-history-list">
          {history.map((record) => (
            <article key={record.id}>
              <strong>{record.roleTitle}</strong>
              <span>
                {difficultyLabels[record.difficulty]} · {record.interviewerName}
              </span>
              <em>{record.score}</em>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function getStageLabel(stage: InterviewStage) {
  switch (stage) {
    case "setup":
      return "配置面试";
    case "briefing":
      return "面试开场";
    case "question":
      return "正在提问";
    case "summary":
      return "复盘报告";
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
