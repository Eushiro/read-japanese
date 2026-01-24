import { createContext, type ReactNode, useContext, useState } from "react";

interface ReviewSessionContextType {
  cardsLeft: number | null; // null means no active session
  setCardsLeft: (count: number | null) => void;
}

const ReviewSessionContext = createContext<ReviewSessionContextType | null>(null);

export function ReviewSessionProvider({ children }: { children: ReactNode }) {
  const [cardsLeft, setCardsLeft] = useState<number | null>(null);

  return (
    <ReviewSessionContext.Provider value={{ cardsLeft, setCardsLeft }}>
      {children}
    </ReviewSessionContext.Provider>
  );
}

export function useReviewSession() {
  const context = useContext(ReviewSessionContext);
  if (!context) {
    throw new Error("useReviewSession must be used within a ReviewSessionProvider");
  }
  return context;
}
