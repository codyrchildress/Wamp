import { useRef, useEffect, useCallback } from 'react';
import styles from './Waveform.module.css';

interface WaveformProps {
  peaks: number[];
  totalDuration: number;
  trimStart: number;
  trimEnd: number;
  onTrimStartChange: (v: number) => void;
  onTrimEndChange: (v: number) => void;
}

export function Waveform({
  peaks,
  totalDuration,
  trimStart,
  trimEnd,
  onTrimStartChange,
  onTrimEndChange,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<'start' | 'end' | null>(null);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const mid = h / 2;

    ctx.clearRect(0, 0, w, h);

    const trimStartX = (trimStart / totalDuration) * w;
    const trimEndX = (trimEnd / totalDuration) * w;
    const barWidth = Math.max(1, w / peaks.length - 0.5);

    // Draw each bar
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w;
      const barH = peaks[i] * mid * 0.9;

      // Check if this bar is in the trim region
      const inTrim = x >= trimStartX && x <= trimEndX;

      if (inTrim) {
        ctx.fillStyle = '#4da6e0';
      } else {
        ctx.fillStyle = '#333';
      }

      ctx.fillRect(x, mid - barH, barWidth, barH * 2);
    }

    // Draw trim handles
    ctx.fillStyle = '#e0c44d';

    // Start handle
    ctx.fillRect(trimStartX - 1.5, 0, 3, h);
    // End handle
    ctx.fillRect(trimEndX - 1.5, 0, 3, h);

  }, [peaks, trimStart, trimEnd, totalDuration]);

  const getTimeFromX = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    return (x / rect.width) * totalDuration;
  }, [totalDuration]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const time = getTimeFromX(e.clientX);
    const startDist = Math.abs(time - trimStart);
    const endDist = Math.abs(time - trimEnd);

    // Determine which handle is closer
    if (startDist < endDist) {
      dragRef.current = 'start';
      onTrimStartChange(Math.min(time, trimEnd - 0.1));
    } else {
      dragRef.current = 'end';
      onTrimEndChange(Math.max(time, trimStart + 0.1));
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [getTimeFromX, trimStart, trimEnd, onTrimStartChange, onTrimEndChange]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const time = getTimeFromX(e.clientX);

    if (dragRef.current === 'start') {
      onTrimStartChange(Math.max(0, Math.min(time, trimEnd - 0.1)));
    } else {
      onTrimEndChange(Math.min(totalDuration, Math.max(time, trimStart + 0.1)));
    }
  }, [getTimeFromX, trimStart, trimEnd, totalDuration, onTrimStartChange, onTrimEndChange]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
