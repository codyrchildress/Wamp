import { useCallback } from 'react';
import styles from './Synthesizer.module.css';
import { semitoneToMidi } from '../../audio/Synth';
import type { SynthWaveform, ArpMode } from '../../audio/Synth';
import type { SynthAPI } from '../../hooks/useSynth';

const ARP_MODES: { value: ArpMode; label: string }[] = [
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
  { value: 'updown', label: 'U/D' },
  { value: 'random', label: 'Rnd' },
];

const WAVEFORMS: { value: SynthWaveform; label: string }[] = [
  { value: 'sine', label: 'Sine' },
  { value: 'triangle', label: 'Tri' },
  { value: 'sawtooth', label: 'Saw' },
  { value: 'square', label: 'Sq' },
];

// Keyboard layout for visual display: 2 octaves of piano keys
// Each entry: [semitoneOffset, isBlack, keyLabel]
interface KeyDef {
  semitone: number;
  isBlack: boolean;
  label: string;
  keyHint: string;
}

const BOTTOM_ROW_KEYS: KeyDef[] = [
  { semitone: 0, isBlack: false, label: 'C', keyHint: 'Z' },
  { semitone: 1, isBlack: true, label: 'C#', keyHint: 'S' },
  { semitone: 2, isBlack: false, label: 'D', keyHint: 'X' },
  { semitone: 3, isBlack: true, label: 'D#', keyHint: 'D' },
  { semitone: 4, isBlack: false, label: 'E', keyHint: 'C' },
  { semitone: 5, isBlack: false, label: 'F', keyHint: 'V' },
  { semitone: 6, isBlack: true, label: 'F#', keyHint: 'G' },
  { semitone: 7, isBlack: false, label: 'G', keyHint: 'B' },
  { semitone: 8, isBlack: true, label: 'G#', keyHint: 'H' },
  { semitone: 9, isBlack: false, label: 'A', keyHint: 'N' },
  { semitone: 10, isBlack: true, label: 'A#', keyHint: 'J' },
  { semitone: 11, isBlack: false, label: 'B', keyHint: 'M' },
];

const TOP_ROW_KEYS: KeyDef[] = [
  { semitone: 12, isBlack: false, label: 'C', keyHint: 'Q' },
  { semitone: 13, isBlack: true, label: 'C#', keyHint: '2' },
  { semitone: 14, isBlack: false, label: 'D', keyHint: 'W' },
  { semitone: 15, isBlack: true, label: 'D#', keyHint: '3' },
  { semitone: 16, isBlack: false, label: 'E', keyHint: 'E' },
  { semitone: 17, isBlack: false, label: 'F', keyHint: 'R' },
  { semitone: 18, isBlack: true, label: 'F#', keyHint: '5' },
  { semitone: 19, isBlack: false, label: 'G', keyHint: 'T' },
  { semitone: 20, isBlack: true, label: 'G#', keyHint: '6' },
  { semitone: 21, isBlack: false, label: 'A', keyHint: 'Y' },
  { semitone: 22, isBlack: true, label: 'A#', keyHint: '7' },
  { semitone: 23, isBlack: false, label: 'B', keyHint: 'U' },
  { semitone: 24, isBlack: false, label: 'C', keyHint: 'I' },
];

const ALL_KEYS = [...BOTTOM_ROW_KEYS, ...TOP_ROW_KEYS];

interface SynthesizerProps {
  synth: SynthAPI;
}

export function Synthesizer({ synth }: SynthesizerProps) {
  const {
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
    arpEnabled,
    setArpEnabled,
    arpMode,
    setArpMode,
    arpBpm,
    setArpBpm,
    arpOctaves,
    setArpOctaves,
  } = synth;

  const isNoteActive = useCallback(
    (semitone: number) => {
      const midi = semitoneToMidi(semitone, octave);
      return activeNotes.includes(midi);
    },
    [activeNotes, octave],
  );

  const handleMouseDown = useCallback(
    (semitone: number) => {
      if (!enabled) return;
      const midi = semitoneToMidi(semitone, octave);
      mouseNoteOn(midi);
    },
    [enabled, octave, mouseNoteOn],
  );

  const handleMouseUp = useCallback(
    (semitone: number) => {
      if (!enabled) return;
      const midi = semitoneToMidi(semitone, octave);
      mouseNoteOff(midi);
    },
    [enabled, octave, mouseNoteOff],
  );

  return (
    <div className={`${styles.synth} ${enabled ? styles.enabled : ''}`}>
      <div className={styles.topBar}>
        <button
          className={`${styles.toggleBtn} ${enabled ? styles.on : ''}`}
          onClick={() => setEnabled(!enabled)}
        >
          <span className={styles.toggleDot} />
          SYNTH
        </button>

        {enabled && (
          <>
            {/* Waveform selector */}
            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>Wave</span>
              <div className={styles.waveformBtns}>
                {WAVEFORMS.map((w) => (
                  <button
                    key={w.value}
                    className={`${styles.waveBtn} ${waveform === w.value ? styles.activeWave : ''}`}
                    onClick={() => setWaveform(w.value)}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Octave */}
            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>Oct</span>
              <button className={styles.octaveBtn} onClick={() => setOctave(octave - 1)} disabled={octave <= 1}>-</button>
              <span className={styles.octaveValue}>{octave}</span>
              <button className={styles.octaveBtn} onClick={() => setOctave(octave + 1)} disabled={octave >= 7}>+</button>
            </div>

            {/* Attack */}
            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>Atk</span>
              <input
                type="range"
                className={styles.slider}
                min={0.005}
                max={1}
                step={0.005}
                value={attack}
                onChange={(e) => setAttack(Number(e.target.value))}
              />
            </div>

            {/* Release */}
            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>Rel</span>
              <input
                type="range"
                className={styles.slider}
                min={0.01}
                max={2}
                step={0.01}
                value={release}
                onChange={(e) => setRelease(Number(e.target.value))}
              />
            </div>

            {/* Volume */}
            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>Vol</span>
              <input
                type="range"
                className={styles.slider}
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
              />
            </div>

            {/* Arpeggiator */}
            <div className={styles.arpDivider} />

            <button
              className={`${styles.waveBtn} ${arpEnabled ? styles.arpActive : ''}`}
              onClick={() => setArpEnabled(!arpEnabled)}
            >
              ARP
            </button>

            {arpEnabled && (
              <>
                <div className={styles.controlGroup}>
                  <span className={styles.controlLabel}>Mode</span>
                  <div className={styles.waveformBtns}>
                    {ARP_MODES.map((m) => (
                      <button
                        key={m.value}
                        className={`${styles.waveBtn} ${arpMode === m.value ? styles.activeWave : ''}`}
                        onClick={() => setArpMode(m.value)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.controlGroup}>
                  <span className={styles.controlLabel}>BPM</span>
                  <input
                    type="range"
                    className={styles.slider}
                    min={60}
                    max={600}
                    step={10}
                    value={arpBpm}
                    onChange={(e) => setArpBpm(Number(e.target.value))}
                  />
                  <span className={styles.arpValue}>{arpBpm}</span>
                </div>

                <div className={styles.controlGroup}>
                  <span className={styles.controlLabel}>Oct</span>
                  <button className={styles.octaveBtn} onClick={() => setArpOctaves(arpOctaves - 1)} disabled={arpOctaves <= 1}>-</button>
                  <span className={styles.octaveValue}>{arpOctaves}</span>
                  <button className={styles.octaveBtn} onClick={() => setArpOctaves(arpOctaves + 1)} disabled={arpOctaves >= 4}>+</button>
                </div>
              </>
            )}

            <span className={styles.hint}>Arrows: octave</span>
          </>
        )}
      </div>

      {enabled && (
        <div className={styles.keyboard}>
          {ALL_KEYS.map((k) => (
            <div
              key={`${k.semitone}-${k.keyHint}`}
              className={`${styles.key} ${k.isBlack ? styles.black : styles.white} ${isNoteActive(k.semitone) ? styles.pressed : ''}`}
              onMouseDown={() => handleMouseDown(k.semitone)}
              onMouseUp={() => handleMouseUp(k.semitone)}
              onMouseLeave={() => handleMouseUp(k.semitone)}
            >
              <span className={styles.keyHint}>{k.keyHint}</span>
              <span className={styles.keyNote}>{k.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
