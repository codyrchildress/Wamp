import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PADS, createNoiseBuffer } from '../audio/drumSounds';
import type { DrumSoundFn } from '../audio/drumSounds';

export interface PadState {
  key: string;
  name: string;
  play: DrumSoundFn;
  customBuffer: AudioBuffer | null;
}

export function useDrumKit(getContext: () => AudioContext | null) {
  const [pads, setPads] = useState<PadState[]>(
    DEFAULT_PADS.map((p) => ({ ...p, customBuffer: null })),
  );
  const [activePads, setActivePads] = useState<Set<number>>(new Set());
  const [enabled, setEnabled] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  const padsRef = useRef(pads);
  const assignBufferRef = useRef<AudioBuffer | null>(null);
  padsRef.current = pads;

  const triggerPad = useCallback(
    (index: number) => {
      const ctx = getContext();
      if (!ctx) return;

      const pad = padsRef.current[index];
      if (!pad) return;

      if (pad.customBuffer) {
        const source = ctx.createBufferSource();
        source.buffer = pad.customBuffer;
        source.connect(ctx.destination);
        source.start();
      } else {
        if (!noiseBufferRef.current) {
          noiseBufferRef.current = createNoiseBuffer(ctx);
        }
        pad.play(ctx, ctx.destination, noiseBufferRef.current);
      }

      setActivePads((prev) => new Set(prev).add(index));
      setTimeout(() => {
        setActivePads((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }, 100);
    },
    [getContext],
  );

  const startAssign = useCallback((buffer: AudioBuffer) => {
    assignBufferRef.current = buffer;
    setIsAssigning(true);
    setEnabled(true);
  }, []);

  const cancelAssign = useCallback(() => {
    assignBufferRef.current = null;
    setIsAssigning(false);
  }, []);

  const assignToPad = useCallback((index: number) => {
    const buf = assignBufferRef.current;
    if (!buf) return;
    setPads((prev) =>
      prev.map((pad, i) => (i === index ? { ...pad, customBuffer: buf } : pad)),
    );
    assignBufferRef.current = null;
    setIsAssigning(false);
  }, []);

  const clearPadSample = useCallback((index: number) => {
    setPads((prev) =>
      prev.map((pad, i) =>
        i === index ? { ...pad, customBuffer: null } : pad,
      ),
    );
  }, []);

  // Keyboard handling
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.repeat) return;

      if (isAssigning && e.key === 'Escape') {
        cancelAssign();
        return;
      }

      const key = e.key.toUpperCase();
      const index = padsRef.current.findIndex((p) => p.key === key);
      if (index === -1) return;

      e.preventDefault();

      if (isAssigning) {
        assignToPad(index);
      } else {
        triggerPad(index);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, isAssigning, triggerPad, assignToPad, cancelAssign]);

  return {
    pads,
    activePads,
    enabled,
    setEnabled,
    isAssigning,
    triggerPad,
    startAssign,
    cancelAssign,
    assignToPad,
    clearPadSample,
  };
}

export type DrumKitAPI = ReturnType<typeof useDrumKit>;
