// 键盘 + 触摸圆盘 360° 输入
import { useEffect, useRef } from "react";

export function useGameInput(onSteer: (angle: number) => void) {
  const onSteerRef = useRef(onSteer);
  useEffect(() => { onSteerRef.current = onSteer; });

  useEffect(() => {
    // ── 键盘 ──────────────────────────────────────────────────────────
    function onKey(e: KeyboardEvent) {
      const map: Record<string, number> = {
        ArrowRight: 0, ArrowDown: 90, ArrowLeft: 180, ArrowUp: 270,
        d: 0, s: 90, a: 180, w: 270,
      };
      if (e.key in map) onSteerRef.current(map[e.key]);
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
      rafId = requestAnimationFrame(() => onSteerRef.current(currentAngle));
    }

    function onTouchEnd() {
      steering = false;
      cancelAnimationFrame(rafId);
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      cancelAnimationFrame(rafId);
    };
  }, []);
}
