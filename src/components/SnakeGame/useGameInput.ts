// 键盘 + 触摸 360° 输入，返回当前角度并通过 onSteer 回调发送
import { useEffect, useRef } from "react";

export function useGameInput(onSteer: (angle: number) => void) {
  const onSteerRef = useRef(onSteer);
  useEffect(() => { onSteerRef.current = onSteer; });

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, number> = {
        ArrowRight: 0, ArrowDown: 90, ArrowLeft: 180, ArrowUp: 270,
        d: 0, s: 90, a: 180, w: 270,
      };
      if (e.key in map) onSteerRef.current(map[e.key]);
    }

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY };
    }

    function onTouchMove(e: TouchEvent) {
      if (!touchStartRef.current) return;
      const t = e.touches[0];
      const dx = t.clientX - touchStartRef.current.x;
      const dy = t.clientY - touchStartRef.current.y;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      onSteerRef.current(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360);
      touchStartRef.current = { x: t.clientX, y: t.clientY };
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []); // 空依赖，事件监听器只绑定一次
}
