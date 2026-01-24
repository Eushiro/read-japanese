import { useCallback, useEffect,useRef, useState } from "react";

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  isSupported: boolean;
  hasPermission: boolean | null; // null = not yet requested
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  duration: number; // Recording duration in seconds
}

export interface AudioRecorderActions {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearRecording: () => void;
  getBase64: () => Promise<string | null>;
  getBase64FromBlob: (blob: Blob) => Promise<string>;
}

/**
 * Hook for recording audio using MediaRecorder API
 * Returns audio as blob, URL for playback, and base64 for API calls
 */
export function useAudioRecorder(): AudioRecorderState & AudioRecorderActions {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    isSupported: typeof MediaRecorder !== "undefined",
    hasPermission: null,
    audioBlob: null,
    audioUrl: null,
    error: null,
    duration: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!state.isSupported) {
      setState((prev) => ({
        ...prev,
        error: "Audio recording is not supported in this browser",
      }));
      return;
    }

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // Try to use wav format, fall back to webm
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setState((prev) => ({
          ...prev,
          isRecording: false,
          error: "Recording error occurred",
        }));
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      startTimeRef.current = Date.now();

      // Update duration every 100ms
      durationIntervalRef.current = window.setInterval(() => {
        setState((prev) => ({
          ...prev,
          duration: (Date.now() - startTimeRef.current) / 1000,
        }));
      }, 100);

      // Revoke old URL if exists
      if (state.audioUrl) {
        URL.revokeObjectURL(state.audioUrl);
      }

      setState((prev) => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        hasPermission: true,
        audioBlob: null,
        audioUrl: null,
        error: null,
        duration: 0,
      }));
    } catch (error) {
      console.error("Error starting recording:", error);
      const errorMessage =
        error instanceof Error
          ? error.name === "NotAllowedError"
            ? "Microphone permission denied. Please allow microphone access."
            : error.message
          : "Failed to start recording";

      setState((prev) => ({
        ...prev,
        hasPermission:
          error instanceof Error && error.name === "NotAllowedError" ? false : prev.hasPermission,
        error: errorMessage,
      }));
    }
  }, [state.isSupported, state.audioUrl]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !state.isRecording) {
        resolve(null);
        return;
      }

      const mediaRecorder = mediaRecorderRef.current;

      // Override onstop to resolve the promise
      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);

        setState((prev) => ({
          ...prev,
          isRecording: false,
          isPaused: false,
          audioBlob,
          audioUrl,
        }));

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        // Clear duration interval
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        resolve(audioBlob);
      };

      mediaRecorder.stop();
    });
  }, [state.isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && !state.isPaused) {
      mediaRecorderRef.current.pause();
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  }, [state.isRecording, state.isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && state.isPaused) {
      mediaRecorderRef.current.resume();
      setState((prev) => ({ ...prev, isPaused: false }));
    }
  }, [state.isRecording, state.isPaused]);

  const clearRecording = useCallback(() => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    audioChunksRef.current = [];
    setState((prev) => ({
      ...prev,
      audioBlob: null,
      audioUrl: null,
      duration: 0,
      error: null,
    }));
  }, [state.audioUrl]);

  const getBase64FromBlob = useCallback(async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix (e.g., "data:audio/webm;base64,")
        const base64Data = base64.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  const getBase64 = useCallback(async (): Promise<string | null> => {
    if (!state.audioBlob) return null;
    return getBase64FromBlob(state.audioBlob);
  }, [state.audioBlob, getBase64FromBlob]);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    getBase64,
    getBase64FromBlob,
  };
}
