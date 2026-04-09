import { useCallback, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording' | 'stopped';

export function useRecorder(getRecordingStream: () => MediaStream | null) {
  const [state, setState] = useState<RecorderState>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [duration, setDuration] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const startTimeRef = useRef(0);

  const cleanup = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const startRecording = useCallback(() => {
    const stream = getRecordingStream();
    if (!stream) return;

    cleanup();
    chunksRef.current = [];
    blobRef.current = null;

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
      blobRef.current = blob;
      urlRef.current = URL.createObjectURL(blob);

      const audio = new Audio(urlRef.current);
      audioRef.current = audio;

      audio.onended = () => {
        if (audio.loop) return;
        setIsPlaying(false);
      };

      setState('stopped');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };

    recorder.start(100);
    startTimeRef.current = Date.now();
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 200);
    setState('recording');
  }, [getRecordingStream, cleanup]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
    } else {
      audio.loop = isLooping;
      audio.play();
      setIsPlaying(true);
    }
  }, [isPlaying, isLooping]);

  const toggleLoop = useCallback(() => {
    const next = !isLooping;
    setIsLooping(next);
    if (audioRef.current) {
      audioRef.current.loop = next;
    }
  }, [isLooping]);

  const download = useCallback(() => {
    if (!blobRef.current) return;
    const a = document.createElement('a');
    a.href = urlRef.current!;
    a.download = `wamp-recording-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const discard = useCallback(() => {
    cleanup();
    blobRef.current = null;
    chunksRef.current = [];
    setIsPlaying(false);
    setDuration(0);
    setState('idle');
  }, [cleanup]);

  return {
    state,
    isPlaying,
    isLooping,
    duration,
    hasRecording: state === 'stopped',
    startRecording,
    stopRecording,
    togglePlayback,
    toggleLoop,
    download,
    discard,
  };
}
