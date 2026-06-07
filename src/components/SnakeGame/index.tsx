// 主游戏组件：整合 Canvas、MiniMap、HUD、输入
import { useCallback, useRef } from "react";
import { GameCanvas } from "./GameCanvas";
import { GameHUD } from "./GameHUD";
import { MiniMap } from "./MiniMap";
import { useGameInput } from "./useGameInput";
import { useSnakeGame } from "./useSnakeGame";

interface Props {
  token: string | null;
  onBackToHub: () => void;
}

export function SnakeGame({ token, onBackToHub }: Props) {
  const rendererSteerRef = useRef<((angle: number) => void) | null>(null);
  const {
    snapshot, tickMsRef, subscribeSnapshot,
    connected, mapSize, playerId, steer, leave,
  } = useSnakeGame(token);

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

  useGameInput(handleSteer);

  // 返回前先通知服务端保存分数，留出一帧时间发送再断开
  const handleBack = useCallback(() => {
    leave();
    setTimeout(onBackToHub, 120);
  }, [leave, onBackToHub]);

  // 空格加速（发特殊角度标记，服务端可扩展）
  // 当前版本加速为预留，前端已接收输入

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
        onRendererReady={handleRendererReady}
      />
      <MiniMap snapshot={snapshot} mapSize={mapSize} playerId={playerId} isDead={snapshot?.snakes.find(s => s.id === playerId)?.alive === false} />
      <GameHUD snapshot={snapshot} playerId={playerId} onBackToHub={handleBack} />
    </div>
  );
}
