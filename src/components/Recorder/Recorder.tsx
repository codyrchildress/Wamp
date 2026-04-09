import styles from './Recorder.module.css';
import { useRecorder } from '../../hooks/useRecorder';
import { useAudioEngineContext } from '../../context/AudioEngineContext';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Recorder() {
  const { getRecordingStream } = useAudioEngineContext();
  const {
    state,
    isPlaying,
    isLooping,
    duration,
    startRecording,
    stopRecording,
    togglePlayback,
    toggleLoop,
    download,
    discard,
  } = useRecorder(getRecordingStream);

  return (
    <div className={styles.recorder}>
      {/* Record / Stop button */}
      {state !== 'recording' ? (
        <button
          className={`${styles.btn} ${styles.recordBtn}`}
          onClick={startRecording}
          title="Record"
        >
          <span className={styles.recordDot} />
        </button>
      ) : (
        <button
          className={`${styles.btn} ${styles.stopBtn}`}
          onClick={stopRecording}
          title="Stop recording"
        >
          <span className={styles.stopSquare} />
        </button>
      )}

      {/* Timer */}
      {state === 'recording' && (
        <span className={styles.timer}>{formatTime(duration)}</span>
      )}

      {/* Playback controls (only after recording) */}
      {state === 'stopped' && (
        <>
          <button
            className={`${styles.btn} ${styles.playBtn} ${isPlaying ? styles.active : ''}`}
            onClick={togglePlayback}
            title={isPlaying ? 'Stop' : 'Play'}
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

          <button
            className={`${styles.btn} ${styles.downloadBtn}`}
            onClick={download}
            title="Download recording"
          >
            <svg className={styles.downloadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

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
  );
}
