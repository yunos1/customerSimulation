// 主游戏组件：整合 Canvas、MiniMap、HUD、输入
import { useCallback, useEffect, useRef, useState } from "react";
import { GameCanvas } from "./GameCanvas";
import { GameHUD } from "./GameHUD";
import { MiniMap } from "./MiniMap";
import type { SnakeRendererFlags } from "./SnakeRenderer";
import { useGameInput } from "./useGameInput";
import { useSnakeGame } from "./useSnakeGame";

interface Props {
  token: string | null;
  roomId?: string;
  onBackToHub: () => void;
}

export function SnakeGame({ token, roomId = "main", onBackToHub }: Props) {
  const rendererSteerRef = useRef<((angle: number) => void) | null>(null);
  const [rendererFlags, setRendererFlags] = useState<SnakeRendererFlags>({});
  const {
    hudSnapshot, tickMsRef, subscribeSnapshot,
    connected, mapSize, playerId, steer, setBoosting, leave,
  } = useSnakeGame(token, roomId);

  const handleSteer = useCallback(
    (angle: number) => {
      rendererSteerRef.current?.(angle);
      steer(angle);
    },
    [steer],
  );

  const handleRendererReady = useCallback((api: { setLocalSteer: (angle: number) => void }) => {
    rendererSteerRef.current = api.setLocalSteer;
    return () => {
      if (rendererSteerRef.current === api.setLocalSteer) {
        rendererSteerRef.current = null;
      }
    };
  }, []);

  useGameInput(handleSteer, setBoosting);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "F3") {
        event.preventDefault();
        setRendererFlags((flags) => ({ ...flags, showDebug: !flags.showDebug }));
      } else if (event.key === "1") {
        event.preventDefault();
        setRendererFlags((flags) => ({ ...flags, disablePrediction: !flags.disablePrediction }));
      } else if (event.key === "2") {
        event.preventDefault();
        setRendererFlags((flags) => ({ ...flags, disableCameraSmoothing: !flags.disableCameraSmoothing }));
      } else if (event.key === "3") {
        event.preventDefault();
        setRendererFlags((flags) => ({ ...flags, lowEffects: !flags.lowEffects }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 返回前先通知服务端保存分数，留出一帧时间发送再断开
  const handleBack = useCallback(() => {
    leave();
    setTimeout(onBackToHub, 120);
  }, [leave, onBackToHub]);

  const isDead = hudSnapshot?.me?.alive === false;

  if (!connected) {
    return (
      <div style={{
        width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "#0a0e1a", color: "#fff", flexDirection: "column", gap: 12,
      }}>
        <div style={{ fontSize: 32 }}>🐍</div>
        <div>连接服务器中…</div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#0a0e1a", overflow: "hidden" }}>
      <GameCanvas
        tickMsRef={tickMsRef}
        mapSize={mapSize}
        playerId={playerId}
        subscribeSnapshot={subscribeSnapshot}
        rendererFlags={rendererFlags}
        onRendererReady={handleRendererReady}
      />
      <MiniMap
        subscribeSnapshot={subscribeSnapshot}
        mapSize={mapSize}
        playerId={playerId}
        isDead={isDead}
      />
      <GameHUD
        snapshot={hudSnapshot}
        playerId={playerId}
        onBackToHub={handleBack}
        onBoostChange={setBoosting}
      />
    </div>
  );
}
