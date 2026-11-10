import { useCallback, useEffect, useRef, useState } from "react";

export interface CanvasSize {
  width: number;
  height: number;
  ratio: number;
}

// Keeps a canvas sized to its container at device pixel ratio
export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0, ratio: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      setSize({ width, height, ratio });
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const context = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.setTransform(size.ratio, 0, 0, size.ratio, 0, 0);
    return ctx ?? null;
  }, [size.ratio]);

  return { canvasRef, size, context };
}
