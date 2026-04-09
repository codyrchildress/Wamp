import { useCallback, useEffect, useRef, useState } from 'react';
import { Synth, KEY_TO_SEMITONE, semitoneToMidi } from '../audio/Synth';
import type { SynthWaveform } from '../audio/Synth';

export function useSynth(
  getContext: () => AudioContext | null,
  getInputNode: () => GainNode | null,
  isRunning: boolean,
) {
  const synthRef = useRef<Synth | null>(null);
  const [waveform, setWaveformState] = useState<SynthWaveform>('sawtooth');
  const [octave, setOctaveState] = useState(4);
  const [attack, setAttackState] = useState(0.01);
  const [release, setReleaseState] = useState(0.15);
  const [volume, setVolumeState] = useState(0.3);
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [enabled, setEnabled] = useState(false);
  const heldKeysRef = useRef<Set<string>>(new Set());

  // Create/destroy synth when engine starts/stops
  useEffect(() => {
    if (isRunning && enabled) {
      const ctx = getContext();
      const inputNode = getInputNode();
      if (ctx && inputNode) {
        const synth = new Synth(ctx, inputNode);
        synth.waveform = waveform;
        synth.octave = octave;
        synth.attack = attack;
        synth.release = release;
        synth.volume = volume;
        synthRef.current = synth;
      }
    }
    const held = heldKeysRef.current;
    return () => {
      synthRef.current?.dispose();
      synthRef.current = null;
      held.clear();
      setActiveNotes([]);
    };
    // Only recreate when enabled/isRunning changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, enabled]);

  // Keyboard event handlers
  useEffect(() => {
    if (!isRunning || !enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.repeat) return;

      const key = e.key.toLowerCase();

      // Octave shift with arrow keys
      if (key === 'arrowleft' || key === 'arrowdown') {
        e.preventDefault();
        setOctaveState((prev) => {
          const next = Math.max(1, prev - 1);
          if (synthRef.current) synthRef.current.octave = next;
          return next;
        });
        setActiveNotes([]);
        heldKeysRef.current.clear();
        return;
      }
      if (key === 'arrowright' || key === 'arrowup') {
        e.preventDefault();
        setOctaveState((prev) => {
          const next = Math.min(7, prev + 1);
          if (synthRef.current) synthRef.current.octave = next;
          return next;
        });
        setActiveNotes([]);
        heldKeysRef.current.clear();
        return;
      }

      const semitone = KEY_TO_SEMITONE[key];
      if (semitone === undefined) return;

      e.preventDefault();
      if (heldKeysRef.current.has(key)) return;
      heldKeysRef.current.add(key);

      const synth = synthRef.current;
      if (!synth) return;

      const midi = semitoneToMidi(semitone, synth.octave);
      synth.noteOn(midi);
      setActiveNotes(synth.getActiveNotes());
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const semitone = KEY_TO_SEMITONE[key];
      if (semitone === undefined) return;

      heldKeysRef.current.delete(key);

      const synth = synthRef.current;
      if (!synth) return;

      const midi = semitoneToMidi(semitone, synth.octave);
      synth.noteOff(midi);
      setActiveNotes(synth.getActiveNotes());
    };

    // Kill all notes if window loses focus
    const handleBlur = () => {
      synthRef.current?.allNotesOff();
      heldKeysRef.current.clear();
      setActiveNotes([]);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    const held = heldKeysRef.current;
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      synthRef.current?.allNotesOff();
      held.clear();
    };
  }, [isRunning, enabled]);

  const setWaveform = useCallback((w: SynthWaveform) => {
    setWaveformState(w);
    if (synthRef.current) synthRef.current.waveform = w;
  }, []);

  const setOctave = useCallback((o: number) => {
    const clamped = Math.max(1, Math.min(7, o));
    setOctaveState(clamped);
    if (synthRef.current) synthRef.current.octave = clamped;
  }, []);

  const setAttack = useCallback((v: number) => {
    setAttackState(v);
    if (synthRef.current) synthRef.current.attack = v;
  }, []);

  const setRelease = useCallback((v: number) => {
    setReleaseState(v);
    if (synthRef.current) synthRef.current.release = v;
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (synthRef.current) synthRef.current.volume = v;
  }, []);

  // Mouse note triggers (for clicking the visual keyboard)
  const mouseNoteOn = useCallback((midi: number) => {
    synthRef.current?.noteOn(midi);
    setActiveNotes(synthRef.current?.getActiveNotes() ?? []);
  }, []);

  const mouseNoteOff = useCallback((midi: number) => {
    synthRef.current?.noteOff(midi);
    setActiveNotes(synthRef.current?.getActiveNotes() ?? []);
  }, []);

  return {
    enabled,
    setEnabled,
    waveform,
    setWaveform,
    octave,
    setOctave,
    attack,
    setAttack,
    release,
    setRelease,
    volume,
    setVolume,
    activeNotes,
    mouseNoteOn,
    mouseNoteOff,
  };
}

export type SynthAPI = ReturnType<typeof useSynth>;
