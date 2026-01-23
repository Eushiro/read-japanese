import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Check, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeedbackDisplayProps {
  accuracyScore: number;
  feedbackText: string;
  feedbackAudioUrl?: string | null;
  userRecordingUrl?: string | null;
  targetText: string;
  language: "japanese" | "english" | "french";
}

export function FeedbackDisplay({
  accuracyScore,
  feedbackText,
  feedbackAudioUrl,
  userRecordingUrl,
  targetText,
  language,
}: FeedbackDisplayProps) {
  const [isPlayingFeedback, setIsPlayingFeedback] = useState(false);
  const [isPlayingUser, setIsPlayingUser] = useState(false);
  const feedbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (feedbackAudioRef.current) {
        feedbackAudioRef.current.pause();
      }
      if (userAudioRef.current) {
        userAudioRef.current.pause();
      }
    };
  }, []);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-amber-500";
    return "text-red-500";
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return "Excellent!";
    if (score >= 80) return "Great job!";
    if (score >= 70) return "Good effort!";
    if (score >= 60) return "Keep practicing!";
    return "Try again!";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 70) {
      return <Check className="w-8 h-8 text-green-500" />;
    }
    if (score >= 50) {
      return <Sparkles className="w-8 h-8 text-amber-500" />;
    }
    return <AlertCircle className="w-8 h-8 text-red-500" />;
  };

  const playFeedbackAudio = () => {
    if (!feedbackAudioUrl) return;

    if (feedbackAudioRef.current) {
      if (isPlayingFeedback) {
        feedbackAudioRef.current.pause();
        feedbackAudioRef.current.currentTime = 0;
        setIsPlayingFeedback(false);
      } else {
        // Stop user audio if playing
        if (userAudioRef.current && isPlayingUser) {
          userAudioRef.current.pause();
          userAudioRef.current.currentTime = 0;
          setIsPlayingUser(false);
        }
        feedbackAudioRef.current.play();
        setIsPlayingFeedback(true);
      }
    }
  };

  const playUserAudio = () => {
    if (!userRecordingUrl) return;

    if (userAudioRef.current) {
      if (isPlayingUser) {
        userAudioRef.current.pause();
        userAudioRef.current.currentTime = 0;
        setIsPlayingUser(false);
      } else {
        // Stop feedback audio if playing
        if (feedbackAudioRef.current && isPlayingFeedback) {
          feedbackAudioRef.current.pause();
          feedbackAudioRef.current.currentTime = 0;
          setIsPlayingFeedback(false);
        }
        userAudioRef.current.play();
        setIsPlayingUser(true);
      }
    }
  };

  return (
    <div className="animate-fade-in-up space-y-6">
      {/* Hidden audio elements */}
      {feedbackAudioUrl && (
        <audio
          ref={feedbackAudioRef}
          src={feedbackAudioUrl}
          onEnded={() => setIsPlayingFeedback(false)}
        />
      )}
      {userRecordingUrl && (
        <audio
          ref={userAudioRef}
          src={userRecordingUrl}
          onEnded={() => setIsPlayingUser(false)}
        />
      )}

      {/* Score header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          {getScoreIcon(accuracyScore)}
          <span className="text-xl font-semibold text-foreground">
            {getScoreLabel(accuracyScore)}
          </span>
        </div>

        {/* Score circle */}
        <div className="inline-flex items-center justify-center">
          <div className="relative w-32 h-32">
            {/* Background circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${(accuracyScore / 100) * 352} 352`}
                strokeLinecap="round"
                className={getScoreColor(accuracyScore)}
              />
            </svg>
            {/* Score text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-4xl font-bold ${getScoreColor(accuracyScore)}`}>
                {accuracyScore}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Target sentence reminder */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <p className="text-sm text-foreground-muted mb-1">Target sentence:</p>
        <p
          className="text-lg text-foreground"
          style={{ fontFamily: language === "japanese" ? "var(--font-japanese)" : "inherit" }}
        >
          {targetText}
        </p>
      </div>

      {/* Audio playback buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {userRecordingUrl && (
          <Button
            variant="outline"
            onClick={playUserAudio}
            className="flex-1 gap-2"
          >
            {isPlayingUser ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
            {isPlayingUser ? "Stop" : "Play Your Recording"}
          </Button>
        )}

        {feedbackAudioUrl && (
          <Button
            onClick={playFeedbackAudio}
            className={`flex-1 gap-2 ${
              isPlayingFeedback
                ? "bg-accent/80"
                : "bg-gradient-to-r from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 shadow-lg shadow-accent/25 animate-pulse-subtle"
            }`}
          >
            {isPlayingFeedback ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <Volume2 className="w-4 h-4" />
              </>
            )}
            {isPlayingFeedback ? "Stop" : "Play AI Feedback"}
          </Button>
        )}
      </div>

      {/* Text feedback */}
      {feedbackText && (
        <div className="bg-accent/5 rounded-xl border border-accent/20 p-4">
          <p className="text-sm font-medium text-accent mb-2">Feedback</p>
          <p className="text-foreground">{feedbackText}</p>
        </div>
      )}

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-foreground-muted">Accuracy</span>
          <span className={`font-medium ${getScoreColor(accuracyScore)}`}>
            {accuracyScore}%
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getScoreBgColor(accuracyScore)}`}
            style={{ width: `${accuracyScore}%` }}
          />
        </div>
      </div>
    </div>
  );
}
