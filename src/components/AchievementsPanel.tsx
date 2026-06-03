import { Award, LockKeyhole } from "lucide-react";
import { achievements } from "../content/achievements";
import type { AchievementId, AchievementStats } from "../game/types";

interface AchievementsPanelProps {
  unlockedIds: AchievementId[];
  stats: AchievementStats;
}

export function AchievementsPanel({ unlockedIds, stats }: AchievementsPanelProps) {
  const unlockedSet = new Set(unlockedIds);

  return (
    <section className="panel compact-panel achievements-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">成就系统</p>
          <h2>
            {unlockedIds.length}/{achievements.length} 已解锁
          </h2>
        </div>
        <Award size={20} aria-hidden="true" />
      </div>

      <div className="achievement-stats">
        <span>解决 {stats.resolvedCount}</span>
        <span>提醒 {stats.timeoutCount}</span>
        <span>自由回复 {stats.freeReplyCount}</span>
      </div>

      <div className="achievement-list">
        {achievements.map((achievement) => {
          const unlocked = unlockedSet.has(achievement.id);

          return (
            <article
              className={`achievement-item ${unlocked ? "achievement-unlocked" : "achievement-locked"}`}
              key={achievement.id}
            >
              <span className="achievement-icon">
                {unlocked ? <Award size={16} aria-hidden="true" /> : <LockKeyhole size={15} aria-hidden="true" />}
              </span>
              <span className="achievement-copy">
                <span className="achievement-title-row">
                  <strong>{achievement.title}</strong>
                  <small>{achievement.category}</small>
                </span>
                <span>{achievement.description}</span>
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
