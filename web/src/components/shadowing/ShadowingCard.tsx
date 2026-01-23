import { useState, useRef, useEffect } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Volume2, VolumeX, RefreshCw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioRecorder } from "./AudioRecorder";
import { FeedbackDisplay } from "./FeedbackDisplay";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

/**
 * Convert audio blob (webm) to WAV format for API compatibility
 */
async function convertToWav(audioBlob: Blob): Promise<string> {
  const audioContext = new AudioContext();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Convert to WAV
  const numberOfChannels = 1; // Mono
  const sampleRate = 16000; // 16kHz for speech
  const length = audioBuffer.length * (sampleRate / audioBuffer.sampleRate);
  const offlineContext = new OfflineAudioContext(numberOfChannels, length, sampleRate);

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start();

  const renderedBuffer = await offlineContext.startRendering();

  // Encode as WAV
  const wavData = encodeWav(renderedBuffer);

  // Convert to base64
  const base64 = btoa(String.fromCharCode(...new Uint8Array(wavData)));
  await audioContext.close();

  return base64;
}

function encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const samples = audioBuffer.getChannelData(0);
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

interface FlashcardWithVocab {
  _id: Id<"flashcards">;
  vocabularyId: Id<"vocabulary">;
  sentence: string;
  sentenceTranslation: string;
  audioUrl?: string | null;
  vocabulary: {
    _id: Id<"vocabulary">;
    word: string;
    reading?: string | null;
    definitions: string[];
    language: "japanese" | "english" | "french";
  } | null;
}

interface ShadowingCardProps {
  flashcard: FlashcardWithVocab;
  userId: string;
  onNext?: () => void;
  onComplete?: () => void;
}

type CardState = "ready" | "recording" | "processing" | "results";

export function ShadowingCard({
  flashcard,
  userId,
  onNext,
  onComplete,
}: ShadowingCardProps) {
  const [cardState, setCardState] = useState<CardState>("ready");
  const [isPlayingTarget, setIsPlayingTarget] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<{
    accuracyScore: number;
    feedbackText: string;
    feedbackAudioUrl?: string;
  } | null>(null);

  const targetAudioRef = useRef<HTMLAudioElement | null>(null);

  const recorder = useAudioRecorder();
  const evaluateShadowing = useAction(api.ai.evaluateShadowing);
  const submitShadowing = useMutation(api.shadowing.submit);

  const language = flashcard.vocabulary?.language ?? "japanese";

  // Reset state when flashcard changes
  useEffect(() => {
    setCardState("ready");
    setFeedbackResult(null);
    recorder.clearRecording();
    setIsPlayingTarget(false);
    if (targetAudioRef.current) {
      targetAudioRef.current.pause();
      targetAudioRef.current.currentTime = 0;
    }
  }, [flashcard._id]);

  const playTargetAudio = () => {
    if (!flashcard.audioUrl || !targetAudioRef.current) return;

    if (isPlayingTarget) {
      targetAudioRef.current.pause();
      targetAudioRef.current.currentTime = 0;
      setIsPlayingTarget(false);
    } else {
      targetAudioRef.current.play();
      setIsPlayingTarget(true);
    }
  };

  const handleStartRecording = async () => {
    await recorder.startRecording();
    setCardState("recording");
  };

  const handleStopRecording = async () => {
    const blob = await recorder.stopRecording();
    setCardState("processing");

    try {
      if (!blob) {
        throw new Error("Failed to get audio data");
      }

      // Convert webm to WAV for API compatibility
      const audioBase64 = await convertToWav(blob);

      // Call AI to evaluate
      const result = await evaluateShadowing({
        targetText: flashcard.sentence,
        targetLanguage: language,
        userAudioBase64: audioBase64,
      });

      // Convert feedback audio to data URL if present
      let feedbackAudioUrl: string | undefined;
      if (result.feedbackAudioBase64) {
        feedbackAudioUrl = `data:audio/wav;base64,${result.feedbackAudioBase64}`;
      }

      setFeedbackResult({
        accuracyScore: result.accuracyScore,
        feedbackText: result.feedbackText,
        feedbackAudioUrl,
      });

      // Save to database (don't store feedbackAudioUrl - too large for Convex field limit)
      const submitData = {
        userId,
        flashcardId: flashcard._id,
        vocabularyId: flashcard.vocabularyId,
        targetText: flashcard.sentence,
        targetLanguage: language,
        feedbackText: result.feedbackText,
        accuracyScore: result.accuracyScore,
      };
      console.log("Submitting shadowing data:", {
        ...submitData,
        feedbackTextLength: result.feedbackText.length,
        targetTextLength: flashcard.sentence.length,
      });
      await submitShadowing(submitData);

      setCardState("results");
    } catch (error) {
      console.error("Failed to evaluate shadowing:", error);
      setFeedbackResult({
        accuracyScore: 0,
        feedbackText: "Failed to evaluate your recording. Please try again.",
      });
      setCardState("results");
    }
  };

  const handleTryAgain = () => {
    setCardState("ready");
    setFeedbackResult(null);
    recorder.clearRecording();
  };

  const handleNext = () => {
    setCardState("ready");
    setFeedbackResult(null);
    recorder.clearRecording();
    onNext?.();
  };

  return (
    <div className="bg-surface rounded-2xl border border-border overflow-hidden">
      {/* Hidden audio element for target */}
      {flashcard.audioUrl && (
        <audio
          ref={targetAudioRef}
          src={flashcard.audioUrl}
          onEnded={() => setIsPlayingTarget(false)}
        />
      )}

      {/* Target sentence section */}
      <div className="p-6 border-b border-border">
        <div className="text-sm text-foreground-muted mb-2">
          Listen and repeat:
        </div>
        <p
          className="text-2xl font-semibold text-foreground mb-2"
          style={{ fontFamily: language === "japanese" ? "var(--font-japanese)" : "inherit" }}
        >
          {flashcard.sentence}
        </p>
        <p className="text-foreground-muted mb-4">
          {flashcard.sentenceTranslation}
        </p>

        {/* Play target audio button */}
        {flashcard.audioUrl && (
          <Button
            variant="outline"
            onClick={playTargetAudio}
            className="gap-2"
            disabled={cardState === "recording"}
          >
            {isPlayingTarget ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
            {isPlayingTarget ? "Stop" : "Play Target Audio"}
          </Button>
        )}
      </div>

      {/* Recording / Results section */}
      <div className="p-6">
        {cardState === "ready" || cardState === "recording" ? (
          <AudioRecorder
            isRecording={recorder.isRecording}
            isPaused={recorder.isPaused}
            isProcessing={cardState === "processing"}
            duration={recorder.duration}
            hasPermission={recorder.hasPermission}
            error={recorder.error}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStopRecording}
          />
        ) : cardState === "processing" ? (
          <AudioRecorder
            isRecording={false}
            isPaused={false}
            isProcessing={true}
            duration={0}
            hasPermission={true}
            error={null}
            onStartRecording={() => {}}
            onStopRecording={() => {}}
          />
        ) : feedbackResult ? (
          <FeedbackDisplay
            accuracyScore={feedbackResult.accuracyScore}
            feedbackText={feedbackResult.feedbackText}
            feedbackAudioUrl={feedbackResult.feedbackAudioUrl}
            userRecordingUrl={recorder.audioUrl}
            targetText={flashcard.sentence}
            language={language}
          />
        ) : null}
      </div>

      {/* Action buttons */}
      {cardState === "results" && (
        <div className="px-6 pb-6 flex gap-3">
          <Button
            variant="outline"
            onClick={handleTryAgain}
            className="flex-1 gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
          {onNext && (
            <Button onClick={handleNext} className="flex-1 gap-2">
              Next Sentence
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
