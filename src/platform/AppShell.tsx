import { Suspense, useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { SimulatorHub } from "../components/SimulatorHub";
import { supportModeOrder, supportModes } from "../content/career";
import { getModeProgress } from "../game/meta";
import { useAuth } from "../hooks/useAuth";
import { setSimulatorFavicon } from "../hooks/useFavicon";
import { useProgressSync } from "../hooks/useProgressSync";
import { MetaProgressProvider, useMetaProgressContext } from "./MetaProgressContext";
import { loadSimulatorComponent, type SimulatorId } from "./registry";
import type { SimulatorHostProps } from "./types";

/**
 * Platform shell: hub routing, auth/progress injection, and lazy simulator mount.
 * Individual simulators own their engines; this file must not import game reducers.
 */
function AppShellInner() {
  const { meta, applyRemoteMeta, resetCareer } = useMetaProgressContext();
  const { user, loading: authLoading, login, logout } = useAuth();
  useProgressSync(user ?? null, meta, applyRemoteMeta);

  const [activeSimulator, setActiveSimulator] = useState<SimulatorId>("hub");
  const [Loaded, setLoaded] = useState<ComponentType<SimulatorHostProps> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const supportModeList = useMemo(() => supportModeOrder.map((id) => supportModes[id]), []);
  const totalSupportDays = supportModeList.reduce((sum, mode) => sum + mode.days.length, 0);
  const unlockedSupportDays = supportModeList.reduce(
    (sum, mode) => sum + getModeProgress(meta, mode.id).unlockedDayIds.length,
    0,
  );
  const gradedSupportDays = supportModeList.reduce(
    (sum, mode) => sum + Object.keys(getModeProgress(meta, mode.id).bestGrades).length,
    0,
  );

  useEffect(() => {
    setSimulatorFavicon(activeSimulator);
  }, [activeSimulator]);

  useEffect(() => {
    if (activeSimulator === "hub") {
      setLoaded(null);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoaded(null);
    setLoadError(null);
    const pending = loadSimulatorComponent(activeSimulator);
    if (!pending) {
      setLoadError("未知模拟器");
      return;
    }

    pending
      .then((Comp) => {
        if (!cancelled) setLoaded(() => Comp);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError((err as Error).message || "加载失败");
      });

    return () => {
      cancelled = true;
    };
  }, [activeSimulator]);

  const backToHub = useCallback(() => setActiveSimulator("hub"), []);
  const launchSimulator = useCallback((id: Exclude<SimulatorId, "hub">) => {
    setActiveSimulator(id);
  }, []);

  const hostProps: SimulatorHostProps = {
    user: user ?? null,
    authLoading,
    onBackToHub: backToHub,
    onLogin: login,
    onLogout: logout,
  };

  if (activeSimulator === "hub") {
    return (
      <SimulatorHub
        unlockedDays={unlockedSupportDays}
        totalDays={totalSupportDays}
        gradedDays={gradedSupportDays}
        onLaunchSimulator={launchSimulator}
        user={hostProps.user}
        authLoading={authLoading}
        onLogin={login}
        onLogout={logout}
        meta={meta}
        onResetCareer={resetCareer}
      />
    );
  }

  if (loadError) {
    return (
      <main className="hub-shell" style={{ padding: "2rem" }}>
        <p>模拟器加载失败：{loadError}</p>
        <button type="button" className="hub-back-button" onClick={backToHub}>
          返回首页
        </button>
      </main>
    );
  }

  if (!Loaded) {
    return (
      <main className="hub-shell" style={{ padding: "2rem", opacity: 0.8 }}>
        <p>正在加载模拟器…</p>
      </main>
    );
  }

  return (
    <Suspense
      fallback={
        <main className="hub-shell" style={{ padding: "2rem", opacity: 0.8 }}>
          <p>正在加载模拟器…</p>
        </main>
      }
    >
      <Loaded {...hostProps} />
    </Suspense>
  );
}

export default function AppShell() {
  return (
    <MetaProgressProvider>
      <AppShellInner />
    </MetaProgressProvider>
  );
}
