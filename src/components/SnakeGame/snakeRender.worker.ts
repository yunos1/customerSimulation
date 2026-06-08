import { createSnakeRenderer, type SnakeRenderer } from "./SnakeRenderer";
import type { GameSnapshot } from "./useSnakeGame";

type WorkerMessage =
  | { type: "init"; canvas: OffscreenCanvas; width: number; height: number; mapSize: number; playerId: string; tickMs: number }
  | { type: "resize"; width: number; height: number }
  | { type: "config"; mapSize?: number; playerId?: string; tickMs?: number }
  | { type: "snapshot"; snapshot: GameSnapshot; tickMs: number; arrivedAgo: number }
  | { type: "steer"; angle: number }
  | { type: "dispose" };

let renderer: SnakeRenderer | null = null;
let frameId = 0;
let pendingSnapshot: Extract<WorkerMessage, { type: "snapshot" }> | null = null;
let pendingSnapshotTimer = 0;

function requestFrame(callback: FrameRequestCallback) {
  if (typeof self.requestAnimationFrame === "function") {
    return self.requestAnimationFrame(callback);
  }
  return self.setTimeout(() => callback(performance.now()), 16);
}

function cancelFrame(id: number) {
  if (typeof self.cancelAnimationFrame === "function") {
    self.cancelAnimationFrame(id);
  } else {
    self.clearTimeout(id);
  }
}

function startLoop() {
  if (frameId) return;
  const frame = () => {
    renderer?.drawFrame();
    frameId = requestFrame(frame);
  };
  frameId = requestFrame(frame);
}

function stopLoop() {
  if (!frameId) return;
  cancelFrame(frameId);
  frameId = 0;
}

function flushPendingSnapshot() {
  pendingSnapshotTimer = 0;
  if (!renderer || !pendingSnapshot) return;
  const msg = pendingSnapshot;
  pendingSnapshot = null;
  msg.snapshot.arrivedAt = performance.now() - msg.arrivedAgo;
  renderer.pushSnapshot(msg.snapshot, msg.tickMs);
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  if (msg.type === "init") {
    renderer?.dispose();
    stopLoop();
    renderer = createSnakeRenderer(msg.canvas, {
      mapSize: msg.mapSize,
      playerId: msg.playerId,
      tickMs: msg.tickMs,
    });
    renderer.resize(msg.width, msg.height);
    startLoop();
    return;
  }

  if (!renderer) return;

  if (msg.type === "resize") {
    renderer.resize(msg.width, msg.height);
  } else if (msg.type === "config") {
    renderer.setConfig(msg);
  } else if (msg.type === "snapshot") {
    pendingSnapshot = msg;
    if (!pendingSnapshotTimer) {
      pendingSnapshotTimer = self.setTimeout(flushPendingSnapshot, 0);
    }
  } else if (msg.type === "steer") {
    renderer.setLocalSteer(msg.angle);
  } else if (msg.type === "dispose") {
    if (pendingSnapshotTimer) {
      self.clearTimeout(pendingSnapshotTimer);
      pendingSnapshotTimer = 0;
    }
    pendingSnapshot = null;
    renderer.dispose();
    renderer = null;
    stopLoop();
  }
};
