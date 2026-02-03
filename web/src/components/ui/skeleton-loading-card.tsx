import { AnimatePresence, motion } from "framer-motion";

interface SkeletonLoadingCardProps {
  /** The current loading phrase to display */
  loadingPhrase: string;
}

export function SkeletonLoadingCard({ loadingPhrase }: SkeletonLoadingCardProps) {
  return (
    <div className="relative bg-surface rounded-xl border border-border overflow-hidden">
      <div className="p-6 sm:p-8">
        {/* Skeleton structure matching multiple choice layout */}
        <div>
          {/* Skeleton for type badge */}
          <div className="flex items-center gap-2 mb-4">
            <div className="h-6 w-28 rounded-full bg-muted animate-pulse" />
          </div>
          {/* Skeleton for question text */}
          <div className="mb-6 space-y-2">
            <div className="h-5 w-full rounded-md bg-muted animate-pulse" />
            <div className="h-5 w-4/5 rounded-md bg-muted animate-pulse" />
          </div>
          {/* Skeleton for 4 options */}
          <div className="space-y-3">
            <div className="h-14 w-full rounded-xl bg-muted animate-pulse" />
            <div className="h-14 w-full rounded-xl bg-muted animate-pulse" />
            <div className="h-14 w-full rounded-xl bg-muted animate-pulse" />
            <div className="h-14 w-full rounded-xl bg-muted animate-pulse" />
          </div>
        </div>

        {/* Centered overlay with flip animation text */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
          <div className="text-2xl sm:text-3xl font-bold text-center px-4">
            <AnimatePresence mode="wait">
              <motion.span
                key={loadingPhrase}
                className="inline-block bg-gradient-to-r from-yellow-300 via-orange-400 to-purple-400 bg-clip-text text-transparent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
              >
                {loadingPhrase}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
