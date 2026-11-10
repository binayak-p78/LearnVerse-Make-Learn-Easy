import { useEffect, useRef } from "react";

// Calls onFrame with elapsed seconds while running; stops when it returns false
export function useAnimationLoop(running: boolean, onFrame: (dt: number) => boolean | void) {
  const callback = useRef(onFrame);
  callback.current = onFrame;

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (callback.current(dt) === false) return;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
}
