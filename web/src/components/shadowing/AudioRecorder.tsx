import { useRef, useEffect } from "react";
import { Mic, MicOff, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRotatingMessages } from "@/hooks/useRotatingMessages";

const PROCESSING_MESSAGES = [
  "Analyzing your pronunciation...",
  "Listening carefully to your intonation...",
  "Comparing with native speech patterns...",
  "Checking pitch and rhythm...",
  "Preparing personalized feedback...",
  "Evaluating your accent...",
  "Measuring speech clarity...",
  "Detecting subtle nuances...",
  "Processing audio waveforms...",
  "Consulting our language experts...",
  "Fine-tuning the analysis...",
  "Reviewing syllable timing...",
  "Assessing natural flow...",
  "Almost there...",
];

interface AudioRecorderProps {
  isRecording: boolean;
  isPaused: boolean;
  isProcessing: boolean;
  duration: number;
  hasPermission: boolean | null;
  error: string | null;
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
  onStartRecording,
  onStopRecording,
  disabled = false,
}: AudioRecorderProps) {
  const pulseRef = useRef<HTMLDivElement>(null);
  const processingMessage = useRotatingMessages(PROCESSING_MESSAGES, isProcessing, 2500);

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
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-accent/10 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-accent animate-spin" />
          </div>
        </div>
        <p className="text-sm text-foreground-muted transition-opacity duration-300">
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
          <p className="text-sm font-medium text-red-500 mb-1">
            Microphone access denied
          </p>
          <p className="text-sm text-foreground-muted">
            Please allow microphone access in your browser settings to use shadowing practice.
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
          <p className="text-sm font-medium text-amber-500 mb-1">
            Recording error
          </p>
          <p className="text-sm text-foreground-muted">{error}</p>
        </div>
        <Button onClick={onStartRecording} variant="outline" disabled={disabled}>
          Try again
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

      {/* Duration / Instructions */}
      <div className="text-center">
        {isRecording ? (
          <>
            <p className="text-2xl font-mono font-bold text-red-500">
              {formatDuration(duration)}
            </p>
            <p className="text-sm text-foreground-muted">
              Tap to stop recording
            </p>
          </>
        ) : (
          <p className="text-sm text-foreground-muted">
            Tap the microphone to start recording
          </p>
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
