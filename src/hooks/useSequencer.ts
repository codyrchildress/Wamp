import { useCallback, useEffect, useRef, useState } from 'react';
import type { DrumKitAPI } from './useDrumKit';
import type { SynthAPI } from './useSynth';

export type SequencerTarget = 'drums' | 'synth';

export const SEQ_STEPS = 16;
export const DRUM_ROWS = 16;
export const SYNTH_ROWS = 13;

interface SequencerPatterns {
  drums: boolean[][];
  synth: boolean[][];
}

function emptyPattern(rows: number): boolean[][] {
  return Array.from({ length: rows }, () => Array(SEQ_STEPS).fill(false));
}

function stepIntervalMs(bpm: number): number {
  return (60 / bpm / 4) * 1000;
}

export function useSequencer(drumKit: DrumKitAPI, synth: SynthAPI) {
  const [target, setTarget] = useState<SequencerTarget>('drums');
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [octave, setOctave] = useState(4);
  const [patterns, setPatterns] = useState<SequencerPatterns>({
    drums: emptyPattern(DRUM_ROWS),
    synth: emptyPattern(SYNTH_ROWS),
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef(0);
  const drumKitRef = useRef(drumKit);
  const synthRef = useRef(synth);
  const patternsRef = useRef(patterns);
  const targetRef = useRef(target);
  const octaveRef = useRef(octave);
  const bpmRef = useRef(bpm);

  useEffect(() => { drumKitRef.current = drumKit; }, [drumKit]);
  useEffect(() => { synthRef.current = synth; }, [synth]);
  useEffect(() => { patternsRef.current = patterns; }, [patterns]);
  useEffect(() => { targetRef.current = target; }, [target]);
  useEffect(() => { octaveRef.current = octave; }, [octave]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);

  const tick = useCallback(() => {
    const step = stepRef.current;
    const tgt = targetRef.current;
    const pat = patternsRef.current[tgt];

    if (tgt === 'drums') {
      for (let r = 0; r < DRUM_ROWS; r++) {
        if (pat[r][step]) drumKitRef.current.triggerPad(r);
      }
    } else {
      const stepMs = stepIntervalMs(bpmRef.current);
      const noteDur = Math.max(50, stepMs * 0.9);
      for (let r = 0; r < SYNTH_ROWS; r++) {
        if (!pat[r][step]) continue;
        // Row 0 = top of grid = highest note. Last row = C at base octave.
        const semitone = SYNTH_ROWS - 1 - r;
        const midi = 12 * (octaveRef.current + 1) + semitone;
        synthRef.current.mouseNoteOn(midi);
        const capturedMidi = midi;
        setTimeout(() => synthRef.current.mouseNoteOff(capturedMidi), noteDur);
      }
    }

    setCurrentStep(step);
    stepRef.current = (step + 1) % SEQ_STEPS;
  }, []);

  const start = useCallback(() => {
    if (timerRef.current) return;
    if (targetRef.current === 'synth' && !synthRef.current.enabled) {
      synthRef.current.setEnabled(true);
    }
    stepRef.current = 0;
    tick();
    timerRef.current = setInterval(tick, stepIntervalMs(bpmRef.current));
    setIsPlaying(true);
  }, [tick]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    stepRef.current = 0;
    setCurrentStep(-1);
    setIsPlaying(false);
  }, []);

  // Restart timer when BPM changes while playing
  useEffect(() => {
    if (!isPlaying || !timerRef.current) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(tick, stepIntervalMs(bpm));
  }, [bpm, isPlaying, tick]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const toggleStep = useCallback(
    (tgt: SequencerTarget, row: number, step: number) => {
      setPatterns((prev) => {
        const rows = prev[tgt].map((r, i) =>
          i === row ? r.map((c, j) => (j === step ? !c : c)) : r,
        );
        return { ...prev, [tgt]: rows };
      });
    },
    [],
  );

  const clearPattern = useCallback((tgt: SequencerTarget) => {
    setPatterns((prev) => ({
      ...prev,
      [tgt]: emptyPattern(tgt === 'drums' ? DRUM_ROWS : SYNTH_ROWS),
    }));
  }, []);

  return {
    target,
    setTarget,
    bpm,
    setBpm,
    isPlaying,
    currentStep,
    patterns,
    toggleStep,
    clearPattern,
    octave,
    setOctave,
    start,
    stop,
  };
}

export type SequencerAPI = ReturnType<typeof useSequencer>;
