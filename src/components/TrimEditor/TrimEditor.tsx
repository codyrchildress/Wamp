import { useState } from 'react';
import styles from './TrimEditor.module.css';
import { Waveform } from '../Waveform/Waveform';
import type { RecorderAPI } from '../../hooks/useRecorder';

function formatTimePrecise(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

interface TrimEditorProps {
  recorder: RecorderAPI;
}

export function TrimEditor({ recorder }: TrimEditorProps) {
  const {
    totalDuration,
    trimStart,
    trimEnd,
    setTrimStart,
    setTrimEnd,
    waveformPeaks,
  } = recorder;

  const [expanded, setExpanded] = useState(true);
  const trimmedDuration = trimEnd - trimStart;

  if (waveformPeaks.length === 0) return null;

  return (
    <div className={`${styles.editor} ${expanded ? styles.expanded : ''}`}>
      <div className={styles.topBar}>
        <button
          className={`${styles.toggleBtn} ${expanded ? styles.on : ''}`}
          onClick={() => setExpanded(!expanded)}
        >
          <span className={styles.toggleDot} />
          TRIM
        </button>

        {expanded && (
          <div className={styles.timeInfo}>
            <span className={styles.timeLabel}>Start</span>
            <span className={styles.timeValue}>{formatTimePrecise(trimStart)}</span>
            <span className={styles.timeSep} />
            <span className={styles.timeLabel}>Duration</span>
            <span className={styles.timeDuration}>{formatTimePrecise(trimmedDuration)}</span>
            <span className={styles.timeSep} />
            <span className={styles.timeLabel}>End</span>
            <span className={styles.timeValue}>{formatTimePrecise(trimEnd)}</span>
            <span className={styles.timeSep} />
            <span className={styles.timeLabel}>Total</span>
            <span className={styles.timeTotal}>{formatTimePrecise(totalDuration)}</span>
          </div>
        )}
      </div>

      {expanded && (
        <div className={styles.waveformContainer}>
          <Waveform
            peaks={waveformPeaks}
            totalDuration={totalDuration}
            trimStart={trimStart}
            trimEnd={trimEnd}
            onTrimStartChange={setTrimStart}
            onTrimEndChange={setTrimEnd}
          />
        </div>
      )}
    </div>
  );
}
