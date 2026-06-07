// 键盘 + 触摸圆盘 360° 输入
import { useEffect, useRef } from "react";

const STEER_MIN_INTERVAL_MS = 50;
const STEER_MIN_DELTA_DEG = 3;
const STEER_IMMEDIATE_DELTA_DEG = 18;
const KEY_ANGLE_MAP: Record<string, number> = {
  ArrowRight: 0, ArrowDown: 90, ArrowLeft: 180, ArrowUp: 270,
  d: 0, s: 90, a: 180, w: 270,
};

function angleDelta(a: number, b: number) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function useGameInput(onSteer: (angle: number) => void, onBoostChange: (active: boolean) => void) {
  const onSteerRef = useRef(onSteer);
  const onBoostChangeRef = useRef(onBoostChange);
  useEffect(() => { onSteerRef.current = onSteer; });
  useEffect(() => { onBoostChangeRef.current = onBoostChange; });

  useEffect(() => {
    let lastSentAngle: number | null = null;
    let lastSentAt = 0;
    let boostKeyDown = false;
    const sendSteer = (angle: number, force = false) => {
      const now = performance.now();
      const delta = lastSentAngle === null ? Infinity : angleDelta(angle, lastSentAngle);
      if (
        !force &&
        lastSentAngle !== null &&
        (delta < STEER_MIN_DELTA_DEG || (now - lastSentAt < STEER_MIN_INTERVAL_MS && delta < STEER_IMMEDIATE_DELTA_DEG))
      ) {
        return;
      }
      lastSentAngle = angle;
      lastSentAt = now;
      onSteerRef.current(angle);
    };

    // ── 键盘 ──────────────────────────────────────────────────────────
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (!e.repeat && !boostKeyDown) {
          boostKeyDown = true;
          onBoostChangeRef.current(true);
        }
        return;
      }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const angle = KEY_ANGLE_MAP[key];
      if (angle === undefined || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (e.repeat) return;
      sendSteer(angle, true);
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      e.preventDefault();
      if (!boostKeyDown) return;
      boostKeyDown = false;
      onBoostChangeRef.current(false);
    }

    function onBlur() {
      if (!boostKeyDown) return;
      boostKeyDown = false;
      onBoostChangeRef.current(false);
    }

    // ── 触摸圆盘：以初始按下点为圆心，实时计算偏移角度 ──────────────
    const origin = { x: 0, y: 0 };
    let rafId = 0;
    let currentAngle = 0;
    let steering = false;

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      origin.x = t.clientX;
      origin.y = t.clientY;
      steering = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!steering) return;
      const t = e.touches[0];
      const dx = t.clientX - origin.x;
      const dy = t.clientY - origin.y;
      // 死区 8px，避免微小抖动乱转向
      if (dx * dx + dy * dy < 64) return;
      currentAngle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => sendSteer(currentAngle));
    }

    function onTouchEnd() {
      steering = false;
      cancelAnimationFrame(rafId);
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      cancelAnimationFrame(rafId);
      if (boostKeyDown) onBoostChangeRef.current(false);
    };
  }, []);
}
