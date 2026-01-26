import { Loader2, Mic, MicOff, Square } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { useRotatingMessages } from "@/hooks/useRotatingMessages";
import { useT } from "@/lib/i18n";

import { AudioWaveform } from "./AudioWaveform";

interface AudioRecorderProps {
  isRecording: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  duration: number;
  hasPermission: boolean | null;
  error: string | null;
  analyserNode: AnalyserNode | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  disabled?: boolean;
}

export function AudioRecorder({
  isRecording,
  isPaused,
  isProcessing,
  duration,
  hasPermission,
  error,
  analyserNode,
  onStartRecording,
  onStopRecording,
  disabled = false,
}: AudioRecorderProps) {
  const t = useT();
  const pulseRef = useRef<HTMLDivElement>(null);

  const processingMessages = useMemo(
    () => [
      t("common.recording.processing.analyzingPronunciation"),
      t("common.recording.processing.listeningIntonation"),
      t("common.recording.processing.comparingNative"),
      t("common.recording.processing.checkingPitch"),
      t("common.recording.processing.evaluatingAccent"),
      t("common.recording.processing.measuringClarity"),
      t("common.recording.processing.detectingNuances"),
      t("common.recording.processing.processingWaveforms"),
      t("common.recording.processing.reviewingSyllables"),
      t("common.recording.processing.assessingFlow"),
      t("common.recording.processing.examiningVowels"),
      t("common.recording.processing.studyingConsonants"),
      t("common.recording.processing.measuringPauses"),
      t("common.recording.processing.analyzingStress"),
    ],
    [t]
  );
  const processingMessage = useRotatingMessages(processingMessages, isProcessing, 2500);

  // Animate pulse effect when recording
  useEffect(() => {
    if (isRecording && !isPaused && pulseRef.current) {
      pulseRef.current.style.animationPlayState = "running";
    } else if (pulseRef.current) {
      pulseRef.current.style.animationPlayState = "paused";
    }
  }, [isRecording, isPaused]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        {/* Pulsing gradient circle with spinner */}
        <div className="relative">
          <div
            className="w-24 h-24 rounded-full animate-pulse"
            style={{
              background:
                "radial-gradient(circle, rgba(255,132,0,0.25) 0%, rgba(254,237,122,0.15) 50%, transparent 70%)",
            }}
          />
          <Loader2 className="absolute inset-0 m-auto w-10 h-10 text-amber-500 animate-spin" />
        </div>
        <p className="text-sm font-medium text-foreground transition-opacity duration-300">
          {processingMessage}
        </p>
      </div>
    );
  }

  if (hasPermission === false) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center">
          <MicOff className="w-10 h-10 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-red-500 mb-1">{t("common.recording.microphoneDenied")}</p>
          <p className="text-sm text-foreground-muted">
            {t("common.recording.microphoneDeniedHelp")}
          </p>
        </div>
      </div>
    );
  }

  if (error && !isRecording) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center">
          <MicOff className="w-10 h-10 text-amber-500" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-amber-500 mb-1">{t("common.recording.recordingError")}</p>
          <p className="text-sm text-foreground-muted">{error}</p>
        </div>
        <Button onClick={onStartRecording} variant="outline" disabled={disabled}>
          {t("common.recording.tryAgain")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      {/* Recording indicator */}
      <div className="relative">
        {/* Pulse animation */}
        {isRecording && (
          <div
            ref={pulseRef}
            className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse-ring"
            style={{
              animation: "pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
        )}

        {/* Main button */}
        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={disabled}
          className={`
            relative w-24 h-24 rounded-full flex items-center justify-center
            transition-all duration-200
            ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30"
                : "bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/30"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
            active:scale-95
          `}
        >
          {isRecording ? (
            <Square className="w-10 h-10" fill="currentColor" />
          ) : (
            <Mic className="w-10 h-10" />
          )}
        </button>
      </div>

      {/* Real-time waveform visualization */}
      {isRecording && (
        <div className="w-full flex justify-center">
          <AudioWaveform analyserNode={analyserNode} height={48} width={240} />
        </div>
      )}

      {/* Duration / Instructions */}
      <div className="text-center">
        {isRecording ? (
          <>
            <p className="text-2xl font-mono font-bold text-red-500">{formatDuration(duration)}</p>
            <p className="text-sm text-foreground-muted">{t("common.recording.tapToStop")}</p>
          </>
        ) : (
          <p className="text-sm text-foreground-muted">{t("common.recording.tapToStart")}</p>
        )}
      </div>

      {/* Custom CSS for pulse animation */}
      <style>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
