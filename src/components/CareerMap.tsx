import { CheckCircle2, Lock, Play, RotateCcw, Star } from "lucide-react";
import { memo } from "react";
import type { CareerDay, Grade } from "../game/types";

export interface CareerMapDay {
  day: CareerDay;
  unlocked: boolean;
  bestGrade?: Grade;
  isCurrent: boolean;
}

interface CareerMapProps {
  days: CareerMapDay[];
  title?: string;
  intro?: string;
  onSelectDay: (dayId: string) => void;
  /** 重置整条生涯进度（清空解锁与最佳评级）。 */
  onResetCareer?: () => void;
}

export const CareerMap = memo(function CareerMap({
  days,
  title = "转正之路",
  intro = "从实习到转正考核，难度逐天提升。达到每天的过关评级才能解锁下一天。",
  onSelectDay,
  onResetCareer,
}: CareerMapProps) {
  const hasProgress = days.some(({ bestGrade }) => Boolean(bestGrade));

  return (
    <section className="panel career-map">
      <div className="panel-header">
        <div>
          <p className="eyebrow">职业进度</p>
          <h2>{title}</h2>
        </div>
        {onResetCareer && hasProgress ? (
          <button
            className="secondary-button career-reset-button"
            type="button"
            onClick={onResetCareer}
          >
            <RotateCcw size={14} aria-hidden="true" />
            重置进度
          </button>
        ) : null}
      </div>

      <p className="career-map-intro">
        {intro}
      </p>

      <ol className="career-day-list">
        {days.map(({ day, unlocked, bestGrade, isCurrent }, index) => (
          <li
            className={`career-day ${unlocked ? "career-day-unlocked" : "career-day-locked"} ${
              isCurrent ? "career-day-current" : ""
            }`}
            key={day.id}
          >
            <div className="career-day-index">
              {bestGrade ? (
                <span className="career-day-grade">{bestGrade}</span>
              ) : (
                <span>{index + 1}</span>
              )}
            </div>

            <div className="career-day-body">
              <div className="career-day-title-row">
                <strong>{day.title}</strong>
                {bestGrade ? (
                  <span className="career-day-cleared">
                    <CheckCircle2 size={14} aria-hidden="true" />
                    最佳 {bestGrade}
                  </span>
                ) : null}
              </div>
              <small>{day.briefing}</small>
              <span className="career-day-meta">
                <span>客户 {day.generation.customerCount} 位</span>
                <span className="career-day-pass">
                  <Star size={12} aria-hidden="true" />
                  过关 {day.passGrade}
                </span>
              </span>
            </div>

            <div className="career-day-action">
              {unlocked ? (
                <button
                  className="primary-button career-day-button"
                  type="button"
                  onClick={() => onSelectDay(day.id)}
                >
                  <Play size={15} aria-hidden="true" />
                  {bestGrade ? "再来一次" : "进入值班"}
                </button>
              ) : (
                <span className="career-day-lock" aria-label="未解锁">
                  <Lock size={16} aria-hidden="true" />
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
});
