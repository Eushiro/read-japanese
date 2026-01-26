import { motion, useScroll, useTransform } from "framer-motion";
import { useMemo } from "react";

interface PremiumBackgroundProps {
  variant?: "hero" | "page" | "subtle";
  showStars?: boolean;
  showOrbs?: boolean;
}

export function PremiumBackground({
  variant = "page",
  showStars = true,
  showOrbs = true,
}: PremiumBackgroundProps) {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, 100]);
  const y2 = useTransform(scrollY, [0, 1000], [0, -50]);
  const y3 = useTransform(scrollY, [0, 1000], [0, 75]);

  const orbConfig = useMemo(() => {
    const sizes = {
      hero: { orange: 600, purple: 500, yellow: 400 },
      page: { orange: 400, purple: 350, yellow: 300 },
      subtle: { orange: 300, purple: 250, yellow: 200 },
    };

    const opacities = {
      hero: { orange: 0.25, purple: 0.2, yellow: 0.15 },
      page: { orange: 0.2, purple: 0.15, yellow: 0.12 },
      subtle: { orange: 0.15, purple: 0.12, yellow: 0.1 },
    };

    return { sizes: sizes[variant], opacities: opacities[variant] };
  }, [variant]);

  // Generate stable star positions
  const stars = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => ({
      id: i,
      left: `${(i * 17 + 5) % 100}%`,
      top: `${(i * 23 + 10) % 100}%`,
      delay: (i % 8) * 0.6,
      duration: 3 + (i % 5),
    }));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Animated gradient orbs with parallax */}
      {showOrbs && (
        <>
          {/* Orange orb - top left area */}
          <motion.div
            className="absolute rounded-full blur-[120px]"
            style={{
              width: orbConfig.sizes.orange,
              height: orbConfig.sizes.orange,
              background: `radial-gradient(circle, rgba(255, 132, 0, ${orbConfig.opacities.orange}) 0%, transparent 70%)`,
              top: "5%",
              left: "15%",
              y: y1,
            }}
            animate={{
              x: [0, 80, 0],
              scale: [1, 1.15, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Purple orb - right area */}
          <motion.div
            className="absolute rounded-full blur-[100px]"
            style={{
              width: orbConfig.sizes.purple,
              height: orbConfig.sizes.purple,
              background: `radial-gradient(circle, rgba(168, 85, 247, ${orbConfig.opacities.purple}) 0%, transparent 70%)`,
              top: "40%",
              right: "10%",
              y: y2,
            }}
            animate={{
              x: [0, -60, 0],
              y: [0, 40, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Yellow orb - bottom area */}
          <motion.div
            className="absolute rounded-full blur-[80px]"
            style={{
              width: orbConfig.sizes.yellow,
              height: orbConfig.sizes.yellow,
              background: `radial-gradient(circle, rgba(254, 237, 122, ${orbConfig.opacities.yellow}) 0%, transparent 70%)`,
              bottom: "15%",
              left: "30%",
              y: y3,
            }}
            animate={{
              x: [0, 50, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </>
      )}

      {/* Floating stars */}
      {showStars && (
        <>
          {stars.map((star) => (
            <motion.div
              key={star.id}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: star.left,
                top: star.top,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.1, 0.4, 0.1],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: star.duration,
                repeat: Infinity,
                delay: star.delay,
                ease: "easeInOut",
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
