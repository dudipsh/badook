import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceRecorderState = 'idle' | 'recording' | 'processing';

export interface VoiceRecorderApi {
  state: VoiceRecorderState;
  elapsed: number;
  isSupported: boolean;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  reset: () => void;
}

const isMediaRecorderSupported = () =>
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia;

export const useVoiceRecorder = (): VoiceRecorderApi => {
  const [state, setState] = useState<VoiceRecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isSupported = isMediaRecorderSupported();

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopTimer();
      try {
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
      cleanupStream();
    };
  }, []);

  const start = useCallback(async () => {
    if (!isSupported) throw new Error('MediaRecorder not supported');
    if (state !== 'idle') return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();
    recorderRef.current = recorder;
    startTimeRef.current = Date.now();
    setElapsed(0);
    setState('recording');

    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 250);
  }, [isSupported, state]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || state !== 'recording') return null;

    stopTimer();
    setState('processing');

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        resolve(new Blob(chunksRef.current, { type }));
      };
      recorder.stop();
    });

    cleanupStream();
    recorderRef.current = null;
    chunksRef.current = [];
    return blob;
  }, [state]);

  const reset = useCallback(() => {
    stopTimer();
    cleanupStream();
    recorderRef.current = null;
    chunksRef.current = [];
    setElapsed(0);
    setState('idle');
  }, []);

  return { state, elapsed, isSupported, start, stop, reset };
};
