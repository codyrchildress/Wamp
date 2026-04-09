import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording' | 'stopped';

/**
 * Encode an AudioBuffer region to a WAV blob.
 */
function encodeWav(buffer: AudioBuffer, start: number, end: number): Blob {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.floor(end * sampleRate);
  const numSamples = endSample - startSample;
  const numChannels = buffer.numberOfChannels;
  const bytesPerSample = 2; // 16-bit
  const dataSize = numSamples * numChannels * bytesPerSample;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, headerSize - 8 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels and write 16-bit PCM
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = headerSize;
  for (let i = startSample; i < endSample; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export function useRecorder(
  getRecordingStream: () => MediaStream | null,
  getContext: () => AudioContext | null,
) {
  const [state, setState] = useState<RecorderState>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState('');
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const startTimeRef = useRef(0);

  const cleanup = useCallback(() => {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    setDownloadUrl(null);
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch { /* ignore */ }
      sourceNodeRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }, [downloadUrl]);

  // Regenerate download URL when trim changes
  useEffect(() => {
    const buf = audioBufferRef.current;
    if (!buf || state !== 'stopped') return;

    const wavBlob = encodeWav(buf, trimStart, trimEnd);
    const url = URL.createObjectURL(wavBlob);
    setDownloadUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setDownloadFilename(`wamp-recording-${Date.now()}.wav`);
  }, [trimStart, trimEnd, state]);

  const startRecording = useCallback(() => {
    const stream = getRecordingStream();
    if (!stream) return;

    cleanup();
    chunksRef.current = [];
    audioBufferRef.current = null;
    setTrimStart(0);
    setTrimEnd(0);
    setTotalDuration(0);
    setWaveformPeaks([]);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });

      // Decode to AudioBuffer for trimming and WAV export
      const ctx = getContext();
      if (ctx) {
        blob.arrayBuffer().then((ab) => ctx.decodeAudioData(ab)).then((audioBuffer) => {
          audioBufferRef.current = audioBuffer;
          const dur = audioBuffer.duration;
          setTotalDuration(dur);
          setTrimStart(0);
          setTrimEnd(dur);

          // Compute waveform peaks for visualization
          const numPeaks = 200;
          const channel = audioBuffer.getChannelData(0);
          const step = Math.floor(channel.length / numPeaks);
          const peaks: number[] = [];
          for (let i = 0; i < numPeaks; i++) {
            let max = 0;
            const start = i * step;
            const end = Math.min(start + step, channel.length);
            for (let j = start; j < end; j++) {
              const abs = Math.abs(channel[j]);
              if (abs > max) max = abs;
            }
            peaks.push(max);
          }
          setWaveformPeaks(peaks);
          setState('stopped');
        });
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };

    recorder.start(100);
    startTimeRef.current = Date.now();
    setRecDuration(0);
    timerRef.current = setInterval(() => {
      setRecDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 200);
    setState('recording');
  }, [getRecordingStream, getContext, cleanup]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (state === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  }, [state, startRecording, stopRecording]);

  const togglePlayback = useCallback(() => {
    const buf = audioBufferRef.current;
    const ctx = getContext();
    if (!buf || !ctx) return;

    if (isPlaying) {
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch { /* ignore */ }
        sourceNodeRef.current = null;
      }
      setIsPlaying(false);
      return;
    }

    const playTrimmed = () => {
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(ctx.destination);
      const offset = trimStart;
      const dur = trimEnd - trimStart;
      source.start(0, offset, dur);
      sourceNodeRef.current = source;
      setIsPlaying(true);

      source.onended = () => {
        if (sourceNodeRef.current !== source) return;
        if (isLooping) {
          playTrimmed();
        } else {
          sourceNodeRef.current = null;
          setIsPlaying(false);
        }
      };
    };

    playTrimmed();
  }, [getContext, isPlaying, isLooping, trimStart, trimEnd]);

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => !prev);
  }, []);

  const discard = useCallback(() => {
    cleanup();
    audioBufferRef.current = null;
    chunksRef.current = [];
    setIsPlaying(false);
    setRecDuration(0);
    setTotalDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setWaveformPeaks([]);
    setState('idle');
  }, [cleanup]);

  // Hotkeys: backtick (`) to toggle recording, space to play/pause
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '`') {
        e.preventDefault();
        if (state === 'recording') {
          stopRecording();
        } else {
          startRecording();
        }
      }
      if (e.key === ' ' && state === 'stopped') {
        e.preventDefault();
        togglePlayback();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [state, startRecording, stopRecording, togglePlayback]);

  return {
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
    hasRecording: state === 'stopped',
    startRecording,
    stopRecording,
    toggleRecording,
    togglePlayback,
    toggleLoop,
    discard,
  };
}

export type RecorderAPI = ReturnType<typeof useRecorder>;
