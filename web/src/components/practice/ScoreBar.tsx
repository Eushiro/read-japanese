import { motion } from "framer-motion";

interface ScoreBarProps {
  label: string;
  score: number; // 0-100
}

export function ScoreBar({ label, score }: ScoreBarProps) {
  const color = score >= 80 ? "#4ade80" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-foreground-muted">{label}</span>
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-foreground) 8%, transparent)",
        }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs text-foreground-muted">{score}%</span>
    </div>
  );
}
