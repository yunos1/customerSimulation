// 主游戏组件：整合 Canvas、MiniMap、HUD、输入
import { useCallback } from "react";
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
  const { snapshot, snapshotRef, connected, mapSize, playerId, steer } = useSnakeGame(token);

  const handleSteer = useCallback(
    (angle: number) => steer(angle),
    [steer],
  );

  useGameInput(handleSteer);

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
      <GameCanvas snapshotRef={snapshotRef} mapSize={mapSize} playerId={playerId} />
      <MiniMap snapshot={snapshot} mapSize={mapSize} playerId={playerId} />
      <GameHUD snapshot={snapshot} playerId={playerId} onBackToHub={onBackToHub} />
    </div>
  );
}
