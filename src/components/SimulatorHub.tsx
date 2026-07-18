import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Briefcase,
  CirclePlay,
  Download,
  Fish,
  Lock,
  Timer,
  Trash2,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import simulatorBoxHero from "../assets/simulator-box-hero.png";
import type { MetaState } from "../game/meta";
import {
  getHubCardMeta,
  getLibraryModules,
  getPrimarySimulator,
  type SupportHubStats,
} from "../platform/registry";
import type { SimulatorId, SimulatorManifest } from "../platform/types";
import type { AuthUser } from "../hooks/useAuth";
import { UserWidget } from "./UserWidget";

interface SimulatorHubProps {
  unlockedDays: number;
  totalDays: number;
  gradedDays: number;
  onLaunchSimulator: (id: Exclude<SimulatorId, "hub">) => void;
  user: AuthUser | null;
  authLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
  meta: MetaState;
  onResetCareer: () => void;
}

export function SimulatorHub({
  unlockedDays,
  totalDays,
  gradedDays,
  onLaunchSimulator,
  user,
  authLoading,
  onLogin,
  onLogout,
  meta,
  onResetCareer,
}: SimulatorHubProps) {
  const supportStats: SupportHubStats = { unlockedDays, totalDays, gradedDays };
  const libraryModules = getLibraryModules();
  const primary = getPrimarySimulator();
  const liveModuleCount = libraryModules.filter((m) => m.manifest.status === "live").length;
  const upcomingModuleCount = libraryModules.filter((m) => m.manifest.status === "soon").length;
  const [busy, setBusy] = useState<"export" | "clear" | null>(null);
  const [dataMessage, setDataMessage] = useState<string | null>(null);

  const launchPrimary = () => {
    if (primary) onLaunchSimulator(primary.manifest.id);
  };

  const launchSlacker = () => {
    if (!user) {
      onLogin();
      return;
    }
    onLaunchSimulator("slacker");
  };

  const exportProgress = useCallback(async () => {
    setBusy("export");
    setDataMessage(null);
    try {
      let payload: unknown = {
        exportedAt: new Date().toISOString(),
        source: "local",
        meta,
      };

      if (user) {
        const res = await fetch("/api/progress?action=export", { method: "POST" });
        if (res.ok) {
          const remote = (await res.json()) as {
            exportedAt?: string;
            userId?: string;
            username?: string;
            updatedAt?: number | null;
            meta?: MetaState | null;
          };
          payload = {
            exportedAt: remote.exportedAt ?? new Date().toISOString(),
            source: "cloud+local",
            userId: remote.userId,
            username: remote.username,
            cloudUpdatedAt: remote.updatedAt ?? null,
            localMeta: meta,
            cloudMeta: remote.meta,
          };
        }
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `yuanshen-progress-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDataMessage(user ? "已导出本地 + 云端进度" : "已导出本地进度");
    } catch {
      setDataMessage("导出失败，请稍后重试");
    } finally {
      setBusy(null);
    }
  }, [meta, user]);

  const clearProgress = useCallback(async () => {
    const ok = window.confirm(
      user
        ? "确定清空本地与云端的客服进度吗？排行榜中的你的客服成绩也会删除。此操作不可撤销。"
        : "确定清空本地客服进度吗？此操作不可撤销。",
    );
    if (!ok) return;

    setBusy("clear");
    setDataMessage(null);
    try {
      if (user) {
        const res = await fetch("/api/progress", { method: "DELETE" });
        if (!res.ok) {
          setDataMessage("云端清空失败");
          return;
        }
      }
      onResetCareer();
      setDataMessage(user ? "本地与云端进度已清空" : "本地进度已清空");
    } catch {
      setDataMessage("清空失败，请稍后重试");
    } finally {
      setBusy(null);
    }
  }, [onResetCareer, user]);

  return (
    <main className="hub-shell">
      <section className="hub-hero" aria-labelledby="hub-title">
        <div className="hub-hero-media" aria-hidden="true">
          <img src={simulatorBoxHero} alt="" />
        </div>
        <div className="hub-hero-copy">
          <div className="hub-user-row">
            <UserWidget user={user} loading={authLoading} onLogin={onLogin} onLogout={onLogout} />
          </div>
          <p className="hub-kicker">
            <Boxes size={18} aria-hidden="true" />
            模拟器盒子
          </p>
          <h1 id="hub-title">冤神 启动！</h1>
          <p className="hub-hero-lede">
            从客服席位启程，穿过门店、诊室与面试间的灯火；厂房的轰鸣在下一格等待亮起。
          </p>

          <div className="hub-actions">
            <button className="hub-primary-action" type="button" onClick={launchPrimary}>
              <CirclePlay size={20} aria-hidden="true" />
              启动客服模拟器
            </button>
            <button
              className="hub-secondary-action hub-slacker-btn"
              type="button"
              onClick={launchSlacker}
            >
              <Fish size={18} aria-hidden="true" className="hub-fish-icon" />
              摸鱼时刻{!user && !authLoading ? " (需登录)" : ""}
            </button>
          </div>

          <div className="hub-data-actions" aria-label="进度数据">
            <button
              type="button"
              className="hub-data-btn"
              onClick={() => void exportProgress()}
              disabled={busy !== null}
            >
              <Download size={15} aria-hidden="true" />
              {busy === "export" ? "导出中…" : "导出进度"}
            </button>
            <button
              type="button"
              className="hub-data-btn hub-data-btn-danger"
              onClick={() => void clearProgress()}
              disabled={busy !== null}
            >
              <Trash2 size={15} aria-hidden="true" />
              {busy === "clear" ? "清空中…" : "清空进度"}
            </button>
            {dataMessage ? <span className="hub-data-msg">{dataMessage}</span> : null}
          </div>

          <div className="hub-readouts" aria-label="盒子状态">
            <span>
              <Zap size={16} aria-hidden="true" />
              {liveModuleCount} 个可玩模块
            </span>
            <span>
              <Timer size={16} aria-hidden="true" />
              {upcomingModuleCount} 个扩展插槽
            </span>
            <span>
              <Trophy size={16} aria-hidden="true" />
              生涯 {unlockedDays}/{totalDays}
            </span>
          </div>
        </div>
      </section>

      <section className="hub-library" id="simulator-library" aria-label="模拟器库">
        <div className="hub-library-heading">
          <p className="hub-kicker">
            <BadgeCheck size={17} aria-hidden="true" />
            Module Bay
          </p>
          <h2>选择一个模拟现场</h2>
        </div>

        <div className="simulator-grid">
          {libraryModules.map((mod) => (
            <SimulatorModuleCard
              key={mod.manifest.id}
              manifest={mod.manifest}
              meta={getHubCardMeta(mod.manifest, supportStats)}
              onLaunch={() => onLaunchSimulator(mod.manifest.id)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function SimulatorModuleCard({
  manifest,
  meta,
  onLaunch,
}: {
  manifest: SimulatorManifest;
  meta: string[];
  onLaunch?: () => void;
}) {
  const Icon = manifest.icon as LucideIcon;
  const isLive = manifest.status === "live";
  // CSS still uses legacy card ids for a few tone/layout hooks.
  const cssId =
    manifest.id === "support"
      ? "customer-support"
      : manifest.id === "interview"
        ? "interview-coach"
        : manifest.id === "shiftRoster"
          ? "shift-roster"
          : manifest.id === "clinicTriage"
            ? "clinic-triage"
            : manifest.id;

  return (
    <article
      className={`simulator-card simulator-card-${manifest.status} simulator-card-${manifest.tone} simulator-card-${cssId}`}
    >
      <div className="simulator-card-topline">
        <span className="simulator-card-icon">
          <Icon size={24} aria-hidden="true" />
        </span>
        <span className="simulator-status">
          {isLive ? <BadgeCheck size={15} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
          {isLive ? "可启动" : "研发中"}
        </span>
      </div>

      <div className="simulator-card-copy">
        <p>{manifest.category}</p>
        <h3>{manifest.title}</h3>
        <span>{manifest.description}</span>
      </div>

      <div className="simulator-module-rail" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>

      <div className="simulator-meta-row">
        {meta.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      {isLive ? (
        <button className="simulator-card-button" type="button" onClick={onLaunch}>
          进入
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      ) : (
        <button className="simulator-card-button simulator-card-button-disabled" type="button" disabled>
          待开放
          <Briefcase size={16} aria-hidden="true" />
        </button>
      )}
    </article>
  );
}
