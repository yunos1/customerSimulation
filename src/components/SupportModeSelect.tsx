import { BadgeCheck, BriefcaseBusiness, Clapperboard, Lock, RadioTower, Sparkles } from "lucide-react";
import { memo } from "react";
import type { SupportModeConfig, SupportModeId } from "../content/career";
import type { ModeProgress } from "../game/meta";

interface SupportModeSelectProps {
  modes: SupportModeConfig[];
  progressByMode: Record<SupportModeId, ModeProgress>;
  onSelectMode: (modeId: SupportModeId) => void;
}

const iconMap = {
  workplace: BriefcaseBusiness,
  comedy: Clapperboard,
  cyber: RadioTower,
} as const;

export const SupportModeSelect = memo(function SupportModeSelect({
  modes,
  progressByMode,
  onSelectMode,
}: SupportModeSelectProps) {
  return (
    <section className="panel support-mode-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">客服风格</p>
          <h2>选择值班模式</h2>
        </div>
        <Sparkles size={20} aria-hidden="true" />
      </div>

      <div className="support-mode-grid">
        {modes.map((mode) => {
          const Icon = iconMap[mode.id];
          const progress = progressByMode[mode.id];
          const clearedCount = Object.keys(progress.bestGrades).length;

          return (
            <article className={`support-mode-card support-mode-card-${mode.accent}`} key={mode.id}>
              <div className="support-mode-icon">
                <Icon size={23} aria-hidden="true" />
              </div>
              <div className="support-mode-copy">
                <p>{mode.category}</p>
                <h3>{mode.title}</h3>
                <span>{mode.description}</span>
              </div>
              <div className="support-mode-progress" aria-label={`${mode.title}进度`}>
                <span>
                  <Lock size={13} aria-hidden="true" />
                  {progress.unlockedDayIds.length}/{mode.days.length} 天解锁
                </span>
                <span>
                  <BadgeCheck size={13} aria-hidden="true" />
                  {clearedCount} 天有评级
                </span>
              </div>
              <button className="primary-button support-mode-button" type="button" onClick={() => onSelectMode(mode.id)}>
                进入模式
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
});
