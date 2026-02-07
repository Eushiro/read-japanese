import { AnimatePresence, motion } from "framer-motion";
import { Check, Mic, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useT } from "@/lib/i18n";

import { ProgressSquares } from "./ProgressSquares";
import type { QuestionViewProps } from "./types";
import { getFontFamily } from "./types";

type RecordingState = "idle" | "recording" | "evaluating" | "done";

interface ShadowRecordProps extends QuestionViewProps {
  /** Callback to submit the audio for evaluation */
  onSubmitAudio: (audioBase64: string) => Promise<{ score: number; feedback: string }>;
}

export function QuestionShadowRecord({
  question,
  language,
  totalQuestions,
  currentIndex,
  previousResults,
  onNext,
  isLastQuestion,
  onSubmitAudio,
}: ShadowRecordProps) {
  const t = useT();
  const fontFamily = getFontFamily(language);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const playAudioRef = useRef<HTMLAudioElement | null>(null);

  const recorder = useAudioRecorder();

  useEffect(() => {
    return () => {
      if (playAudioRef.current) {
        playAudioRef.current.pause();
        playAudioRef.current = null;
      }
    };
  }, []);

  const handlePlayToggle = useCallback(() => {
    if (isPlaying) {
      playAudioRef.current?.pause();
      setIsPlaying(false);
    } else if (question.audioUrl) {
      if (playAudioRef.current) {
        playAudioRef.current.pause();
      }
      const audio = new Audio(question.audioUrl);
      playAudioRef.current = audio;
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      audio.play().catch(() => setIsPlaying(false));
      setHasPlayed(true);
    }
  }, [isPlaying, question.audioUrl]);

  const handleRecordToggle = useCallback(async () => {
    if (recordingState === "idle") {
      await recorder.startRecording();
      setRecordingState("recording");
    } else if (recordingState === "recording") {
      const blob = await recorder.stopRecording();
      if (blob) {
        setRecordingState("evaluating");
        try {
          const base64 = await recorder.getBase64FromBlob(blob);
          const result = await onSubmitAudio(base64);
          setScore(result.score);
          setFeedback(result.feedback);
          setRecordingState("done");
        } catch {
          setRecordingState("done");
          setScore(0);
          setFeedback(t("adaptivePractice.feedback.evaluationFailed"));
        }
      }
    }
  }, [recordingState, recorder, onSubmitAudio, t]);

  const resultsWithCurrent = [...previousResults];
  if (score !== null) {
    if (score >= 80) resultsWithCurrent[currentIndex] = "correct";
    else if (score >= 50) resultsWithCurrent[currentIndex] = "partial";
    else resultsWithCurrent[currentIndex] = "incorrect";
  }

  const showScore = recordingState === "done" && score !== null;

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col bg-background w-full">
      {/* Progress */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
        <ProgressSquares
          totalQuestions={totalQuestions}
          currentIndex={currentIndex}
          previousResults={resultsWithCurrent}
          isAnswered={showScore}
        />
      </div>

      {/* Upper: Audio + Target Sentence */}
      <div
        className="flex flex-col items-center justify-center px-8 pt-16"
        style={{ height: "45vh" }}
      >
        {/* Mini audio player */}
        <motion.div
          className="flex flex-col items-center mb-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <motion.button
            onClick={handlePlayToggle}
            className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer outline-none relative"
            style={{
              border: `2px solid ${isPlaying ? "var(--color-accent)" : "var(--color-border)"}`,
              backgroundColor: "transparent",
            }}
            whileHover={{ borderColor: "var(--color-accent)" }}
            whileTap={{ scale: 0.95 }}
          >
            {isPlaying && (
              <motion.div
                className="absolute w-16 h-16 rounded-full"
                style={{ border: "2px solid var(--color-accent)" }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            {isPlaying ? (
              <Pause className="w-6 h-6 text-accent" />
            ) : (
              <Play className="w-6 h-6 text-foreground-muted ml-0.5" />
            )}
          </motion.button>
          <p
            className="text-sm text-foreground-muted mt-2"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {isPlaying
              ? t("adaptivePractice.playing")
              : hasPlayed
                ? t("adaptivePractice.tapToReplay")
                : t("adaptivePractice.listenFirst")}
          </p>
        </motion.div>

        {/* Target sentence */}
        <motion.p
          className="text-2xl md:text-3xl lg:text-4xl text-center leading-relaxed text-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ fontFamily }}
        >
          {question.question}
        </motion.p>

        {/* Translation */}
        {question.questionTranslation && (
          <motion.p
            className="text-sm italic text-foreground/60 mt-3 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {question.questionTranslation}
          </motion.p>
        )}
      </div>

      {/* Lower: Record Interface */}
      <div className="flex flex-col items-center w-full px-8 pt-8">
        {/* Instruction text */}
        <p
          className="text-sm text-foreground-muted mb-4"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {t("adaptivePractice.shadowInstruction")}
        </p>

        {/* Record button */}
        <motion.button
          onClick={handleRecordToggle}
          disabled={recordingState === "evaluating" || recordingState === "done"}
          className="w-20 h-20 rounded-full flex items-center justify-center cursor-pointer disabled:cursor-default outline-none relative"
          style={{
            border: `2px solid ${
              recordingState === "recording"
                ? "#ef4444"
                : recordingState === "done"
                  ? "#4ade80"
                  : "var(--color-accent)"
            }`,
            backgroundColor: "transparent",
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          whileHover={
            recordingState !== "done" && recordingState !== "evaluating"
              ? { scale: 1.05 }
              : undefined
          }
          whileTap={
            recordingState !== "done" && recordingState !== "evaluating"
              ? { scale: 0.95 }
              : undefined
          }
        >
          {recordingState === "recording" && (
            <motion.div
              className="absolute w-20 h-20 rounded-full"
              style={{ border: "2px solid #ef4444" }}
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          {recordingState === "idle" && <Mic className="w-8 h-8 text-accent" />}
          {recordingState === "recording" && (
            <motion.div
              className="w-6 h-6 rounded-sm"
              style={{ backgroundColor: "#ef4444" }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          )}
          {recordingState === "evaluating" && (
            <motion.div
              className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          )}
          {recordingState === "done" && <Check className="w-8 h-8" style={{ color: "#4ade80" }} />}
        </motion.button>

        {/* Status text */}
        <p
          className="text-sm text-foreground-muted mt-3"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {recordingState === "idle" && t("adaptivePractice.tapToRecord")}
          {recordingState === "recording" && t("adaptivePractice.recordingTapToStop")}
          {recordingState === "evaluating" && t("adaptivePractice.evaluating")}
          {recordingState === "done" && t("adaptivePractice.done")}
        </p>

        {/* Score + feedback */}
        <AnimatePresence>
          {showScore && (
            <motion.div
              className="mt-6 flex flex-col items-center gap-4 w-full max-w-lg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Pronunciation score circle */}
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="var(--color-border)"
                      strokeWidth="4"
                    />
                    <motion.circle
                      cx="32"
                      cy="32"
                      r="28"
                      fill="none"
                      stroke="var(--color-accent)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 28}
                      initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                      animate={{
                        strokeDashoffset: 2 * Math.PI * 28 * (1 - (score ?? 0) / 100),
                      }}
                      transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-foreground">
                    {score}%
                  </span>
                </div>
                <p
                  className="text-foreground-muted text-sm"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {feedback}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Next button */}
        <div className="mt-4">
          <AnimatePresence>
            {showScore && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.6, duration: 0.3 }}
              >
                <Button variant="default" size="lg" onClick={onNext}>
                  {isLastQuestion
                    ? t("adaptivePractice.finishPractice")
                    : t("adaptivePractice.nextQuestion")}
                  &nbsp;→
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
