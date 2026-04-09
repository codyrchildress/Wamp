import styles from './Recorder.module.css';
import { useRecorder } from '../../hooks/useRecorder';
import { useAudioEngineContext } from '../../context/AudioEngineContext';
import { Waveform } from '../Waveform/Waveform';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimePrecise(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export function Recorder() {
  const { getRecordingStream, getContext } = useAudioEngineContext();
  const {
    state,
    isPlaying,
    isLooping,
    recDuration,
    totalDuration,
    trimStart,
    trimEnd,
    setTrimStart,
    setTrimEnd,
    waveformPeaks,
    downloadUrl,
    downloadFilename,
    startRecording,
    stopRecording,
    togglePlayback,
    toggleLoop,
    discard,
  } = useRecorder(getRecordingStream, getContext);

  const trimmedDuration = trimEnd - trimStart;

  return (
    <div className={styles.recorder}>
      <div className={styles.controls}>
        {/* Record / Stop button */}
        {state !== 'recording' ? (
          <button
            className={`${styles.btn} ${styles.recordBtn}`}
            onClick={startRecording}
            title="Record (` key)"
          >
            <span className={styles.recordDot} />
            <span className={styles.btnLabel}>REC</span>
          </button>
        ) : (
          <button
            className={`${styles.btn} ${styles.stopBtn}`}
            onClick={stopRecording}
            title="Stop recording (` key)"
          >
            <span className={styles.stopSquare} />
            <span className={styles.btnLabel}>{formatTime(recDuration)}</span>
          </button>
        )}

        {/* Playback controls (only after recording) */}
        {state === 'stopped' && (
          <>
            <button
              className={`${styles.btn} ${styles.playBtn} ${isPlaying ? styles.active : ''}`}
              onClick={togglePlayback}
              title={isPlaying ? 'Stop' : 'Play trimmed'}
            >
              {isPlaying ? (
                <span className={styles.pauseIcon}>
                  <span /><span />
                </span>
              ) : (
                <span className={styles.playIcon} />
              )}
            </button>

            <button
              className={`${styles.btn} ${styles.loopBtn} ${isLooping ? styles.active : ''}`}
              onClick={toggleLoop}
              title={isLooping ? 'Disable loop' : 'Enable loop'}
            >
              <svg className={styles.loopIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 2l4 4-4 4" />
                <path d="M3 11V9a4 4 0 014-4h14" />
                <path d="M7 22l-4-4 4-4" />
                <path d="M21 13v2a4 4 0 01-4 4H3" />
              </svg>
            </button>

            {downloadUrl && (
              <a
                className={`${styles.btn} ${styles.saveBtn}`}
                href={downloadUrl}
                download={downloadFilename}
                title="Download trimmed WAV"
              >
                SAVE
              </a>
            )}

            <button
              className={`${styles.btn} ${styles.discardBtn}`}
              onClick={discard}
              title="Discard recording"
            >
              &times;
            </button>
          </>
        )}
      </div>

      {/* Waveform + trim */}
      {state === 'stopped' && waveformPeaks.length > 0 && (
        <div className={styles.trimSection}>
          <div className={styles.trimTimes}>
            <span className={styles.trimTime}>{formatTimePrecise(trimStart)}</span>
            <span className={styles.trimDuration}>{formatTimePrecise(trimmedDuration)}</span>
            <span className={styles.trimTime}>{formatTimePrecise(trimEnd)}</span>
          </div>
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
