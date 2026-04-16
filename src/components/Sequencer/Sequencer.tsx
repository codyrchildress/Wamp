import { useState } from 'react';
import styles from './Sequencer.module.css';
import { DEFAULT_PADS } from '../../audio/drumSounds';
import { midiToNoteName } from '../../audio/Synth';
import {
  SEQ_STEPS,
  DRUM_ROWS,
  SYNTH_ROWS,
} from '../../hooks/useSequencer';
import type {
  SequencerAPI,
  SequencerTarget,
} from '../../hooks/useSequencer';

interface SequencerProps {
  sequencer: SequencerAPI;
}

const TARGETS: { value: SequencerTarget; label: string }[] = [
  { value: 'drums', label: 'Drums' },
  { value: 'synth', label: 'Synth' },
];

export function Sequencer({ sequencer }: SequencerProps) {
  const {
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
  } = sequencer;

  const [expanded, setExpanded] = useState(false);

  const rows = target === 'drums' ? DRUM_ROWS : SYNTH_ROWS;
  const grid = patterns[target];

  const rowLabel = (r: number): string => {
    if (target === 'drums') {
      return DEFAULT_PADS[r]?.name ?? '';
    }
    const semitone = SYNTH_ROWS - 1 - r;
    const midi = 12 * (octave + 1) + semitone;
    return midiToNoteName(midi);
  };

  const handleToggle = () => setExpanded((v) => !v);

  return (
    <div className={`${styles.seq} ${expanded ? styles.expanded : ''}`}>
      <div className={styles.topBar}>
        <button
          className={`${styles.toggleBtn} ${expanded ? styles.on : ''}`}
          onClick={handleToggle}
        >
          <span className={styles.toggleDot} />
          SEQUENCER
        </button>

        {expanded && (
          <>
            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>Target</span>
              <div className={styles.segmented}>
                {TARGETS.map((t) => (
                  <button
                    key={t.value}
                    className={`${styles.segBtn} ${target === t.value ? styles.segActive : ''}`}
                    onClick={() => setTarget(t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.controlGroup}>
              <span className={styles.controlLabel}>BPM</span>
              <input
                type="range"
                className={styles.slider}
                min={40}
                max={240}
                step={1}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
              />
              <span className={styles.bpmValue}>{bpm}</span>
            </div>

            {target === 'synth' && (
              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>Oct</span>
                <button
                  className={styles.octaveBtn}
                  onClick={() => setOctave(Math.max(1, octave - 1))}
                  disabled={octave <= 1}
                >
                  -
                </button>
                <span className={styles.octaveValue}>{octave}</span>
                <button
                  className={styles.octaveBtn}
                  onClick={() => setOctave(Math.min(7, octave + 1))}
                  disabled={octave >= 7}
                >
                  +
                </button>
              </div>
            )}

            <button
              className={`${styles.playBtn} ${isPlaying ? styles.playing : ''}`}
              onClick={isPlaying ? stop : start}
            >
              {isPlaying ? '■ Stop' : '▶ Play'}
            </button>

            <button
              className={styles.clearBtn}
              onClick={() => clearPattern(target)}
            >
              Clear
            </button>
          </>
        )}
      </div>

      {expanded && (
        <div className={styles.gridWrap}>
          <div className={styles.stepHeader}>
            <div className={styles.rowLabel} />
            {Array.from({ length: SEQ_STEPS }, (_, i) => (
              <div
                key={i}
                className={`${styles.stepTick} ${
                  i % 4 === 0 ? styles.beat : ''
                } ${currentStep === i ? styles.cursor : ''}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className={styles.row}>
              <div className={styles.rowLabel}>{rowLabel(r)}</div>
              {Array.from({ length: SEQ_STEPS }, (_, s) => {
                const on = grid[r]?.[s] ?? false;
                const isCursor = currentStep === s;
                return (
                  <button
                    key={s}
                    className={[
                      styles.cell,
                      s % 4 === 0 ? styles.beatCell : '',
                      on ? styles.cellOn : '',
                      isCursor ? styles.cellCursor : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => toggleStep(target, r, s)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
