import { useEffect, useRef } from "react";
import { createSnakeRenderer, type SnakeRenderer } from "./SnakeRenderer";
import type { GameSnapshot } from "./useSnakeGame";

type SnapshotSubscriber = (listener: (snapshot: GameSnapshot) => void) => () => void;

interface Props {
  tickMsRef: React.RefObject<number>;
  mapSize: number;
  playerId: string;
  subscribeSnapshot: SnapshotSubscriber;
}

type WorkerCanvasSession = {
  canvas: HTMLCanvasElement;
  worker: Worker;
  refs: number;
  disposeTimer?: ReturnType<typeof setTimeout>;
};

let devWorkerSession: WorkerCanvasSession | null = null;

export function GameCanvas({ tickMsRef, mapSize, playerId, subscribeSnapshot }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const rendererRef = useRef<SnakeRenderer | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;

    const startMainThreadRenderer = () => {
      const renderer = createSnakeRenderer(canvas, {
        mapSize,
        playerId,
        tickMs: tickMsRef.current || 200,
      });
      rendererRef.current = renderer;

      const frame = () => {
        renderer.drawFrame();
        rafRef.current = requestAnimationFrame(frame);
      };
      rafRef.current = requestAnimationFrame(frame);
      return renderer;
    };

    const supportsWorkerRenderer =
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined" &&
      "transferControlToOffscreen" in canvas;

    if (supportsWorkerRenderer) {
      try {
        let worker: Worker;
        if (devWorkerSession?.canvas === canvas) {
          if (devWorkerSession.disposeTimer) {
            clearTimeout(devWorkerSession.disposeTimer);
            devWorkerSession.disposeTimer = undefined;
          }
          devWorkerSession.refs++;
          worker = devWorkerSession.worker;
        } else {
          worker = new Worker(new URL("./snakeRender.worker.ts", import.meta.url), { type: "module" });
          const offscreen = canvas.transferControlToOffscreen();
          worker.postMessage({
            type: "init",
            canvas: offscreen,
            width: Math.max(1, Math.floor(canvas.offsetWidth)),
            height: Math.max(1, Math.floor(canvas.offsetHeight)),
            mapSize,
            playerId,
            tickMs: tickMsRef.current || 200,
          }, [offscreen]);
          if (import.meta.env.DEV) {
            devWorkerSession = { canvas, worker, refs: 1 };
          }
        }
        workerRef.current = worker;
      } catch {
        workerRef.current?.terminate();
        workerRef.current = null;
        if (devWorkerSession?.canvas === canvas) devWorkerSession = null;
        startMainThreadRenderer();
      }
    } else {
      startMainThreadRenderer();
    }

    const resize = () => {
      if (disposed) return;
      const width = Math.max(1, Math.floor(canvas.offsetWidth));
      const height = Math.max(1, Math.floor(canvas.offsetHeight));
      const worker = workerRef.current;
      if (worker) {
        worker.postMessage({ type: "resize", width, height });
      } else {
        rendererRef.current?.resize(width, height);
      }
    };

    resize();
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 80);
    });
    ro.observe(canvas);

    return () => {
      disposed = true;
      ro.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      rendererRef.current?.dispose();
      rendererRef.current = null;
      if (workerRef.current) {
        const session = devWorkerSession;
        if (session?.worker === workerRef.current) {
          session.refs--;
          if (!import.meta.env.DEV) {
            workerRef.current.postMessage({ type: "dispose" });
            workerRef.current.terminate();
            if (devWorkerSession === session) devWorkerSession = null;
          } else if (session.refs <= 0) {
            session.disposeTimer = setTimeout(() => {
              if (session.refs > 0) return;
              session.worker.postMessage({ type: "dispose" });
              session.worker.terminate();
              if (devWorkerSession === session) devWorkerSession = null;
            }, 1000);
          }
        } else {
          workerRef.current.postMessage({ type: "dispose" });
          workerRef.current.terminate();
        }
      }
      workerRef.current = null;
    };
  }, []); // renderer ownership is initialized once; config updates are sent below.

  useEffect(() => {
    const config = { type: "config" as const, mapSize, playerId, tickMs: tickMsRef.current || 200 };
    workerRef.current?.postMessage(config);
    rendererRef.current?.setConfig(config);
  }, [mapSize, playerId, tickMsRef]);

  useEffect(() => {
    return subscribeSnapshot((snapshot) => {
      const tickMs = tickMsRef.current || 200;
      const worker = workerRef.current;
      if (worker) {
        worker.postMessage({ type: "snapshot", snapshot, tickMs });
      } else {
        rendererRef.current?.pushSnapshot(snapshot, tickMs);
      }
    });
  }, [subscribeSnapshot, tickMsRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
    />
  );
}
