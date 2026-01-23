import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// Session activity types
export type SessionActivity =
  | { type: "review"; cardCount: number }
  | { type: "input"; contentType: "story" | "video"; contentId: string; title: string }
  | { type: "output"; wordCount: number };

// Session plan
export interface SessionPlan {
  activities: SessionActivity[];
  estimatedMinutes: number;
  dueCardCount: number;
  vocabWordCount: number;
}

// Session results
export interface SessionResults {
  cardsReviewed: number;
  contentConsumed: { type: "story" | "video"; title: string } | null;
  wordsAdded: number;
  sentencesWritten: number;
  streakInfo: {
    currentStreak: number;
    longestStreak: number;
    isNewRecord: boolean;
  } | null;
}

// Session state
export type SessionState =
  | { status: "idle" }
  | { status: "planning"; selectedDuration: number | null }
  | { status: "active"; plan: SessionPlan; currentActivityIndex: number; results: SessionResults }
  | { status: "complete"; plan: SessionPlan; results: SessionResults };

interface StudySessionContextType {
  state: SessionState;
  // Session control
  startPlanning: () => void;
  setDuration: (minutes: number | null) => void;
  startSession: (plan: SessionPlan) => void;
  advanceToNextActivity: () => void;
  completeSession: (streakInfo: SessionResults["streakInfo"]) => void;
  exitSession: () => void;
  // Results tracking
  recordCardsReviewed: (count: number) => void;
  recordContentConsumed: (content: { type: "story" | "video"; title: string }) => void;
  recordWordsAdded: (count: number) => void;
  recordSentencesWritten: (count: number) => void;
}

const StudySessionContext = createContext<StudySessionContextType | null>(null);

export function StudySessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "idle" });

  const startPlanning = useCallback(() => {
    setState({ status: "planning", selectedDuration: null });
  }, []);

  const setDuration = useCallback((minutes: number | null) => {
    setState(prev => {
      if (prev.status !== "planning") return prev;
      return { ...prev, selectedDuration: minutes };
    });
  }, []);

  const startSession = useCallback((plan: SessionPlan) => {
    setState({
      status: "active",
      plan,
      currentActivityIndex: 0,
      results: {
        cardsReviewed: 0,
        contentConsumed: null,
        wordsAdded: 0,
        sentencesWritten: 0,
        streakInfo: null,
      },
    });
  }, []);

  const advanceToNextActivity = useCallback(() => {
    setState(prev => {
      if (prev.status !== "active") return prev;
      const nextIndex = prev.currentActivityIndex + 1;
      if (nextIndex >= prev.plan.activities.length) {
        // Session complete - but wait for streak update
        return prev;
      }
      return { ...prev, currentActivityIndex: nextIndex };
    });
  }, []);

  const completeSession = useCallback((streakInfo: SessionResults["streakInfo"]) => {
    setState(prev => {
      if (prev.status !== "active") return prev;
      return {
        status: "complete",
        plan: prev.plan,
        results: { ...prev.results, streakInfo },
      };
    });
  }, []);

  const exitSession = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const recordCardsReviewed = useCallback((count: number) => {
    setState(prev => {
      if (prev.status !== "active") return prev;
      return {
        ...prev,
        results: { ...prev.results, cardsReviewed: prev.results.cardsReviewed + count },
      };
    });
  }, []);

  const recordContentConsumed = useCallback((content: { type: "story" | "video"; title: string }) => {
    setState(prev => {
      if (prev.status !== "active") return prev;
      return {
        ...prev,
        results: { ...prev.results, contentConsumed: content },
      };
    });
  }, []);

  const recordWordsAdded = useCallback((count: number) => {
    setState(prev => {
      if (prev.status !== "active") return prev;
      return {
        ...prev,
        results: { ...prev.results, wordsAdded: prev.results.wordsAdded + count },
      };
    });
  }, []);

  const recordSentencesWritten = useCallback((count: number) => {
    setState(prev => {
      if (prev.status !== "active") return prev;
      return {
        ...prev,
        results: { ...prev.results, sentencesWritten: prev.results.sentencesWritten + count },
      };
    });
  }, []);

  return (
    <StudySessionContext.Provider
      value={{
        state,
        startPlanning,
        setDuration,
        startSession,
        advanceToNextActivity,
        completeSession,
        exitSession,
        recordCardsReviewed,
        recordContentConsumed,
        recordWordsAdded,
        recordSentencesWritten,
      }}
    >
      {children}
    </StudySessionContext.Provider>
  );
}

export function useStudySession() {
  const context = useContext(StudySessionContext);
  if (!context) {
    throw new Error("useStudySession must be used within a StudySessionProvider");
  }
  return context;
}
