"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import * as React from "react";

type Direction = "up" | "down" | "left" | "right";

interface FadeInProps {
  children: React.ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}

const directionOffsets: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 40 },
  down: { y: -40 },
  left: { x: 40 },
  right: { x: -40 },
};

/**
 * Fade in animation when element scrolls into view.
 * Respects prefers-reduced-motion.
 *
 * @example
 * <FadeIn>
 *   <h1>Hello World</h1>
 * </FadeIn>
 *
 * <FadeIn direction="left" delay={0.2}>
 *   <p>Slides in from the left</p>
 * </FadeIn>
 */
export function FadeIn({
  children,
  direction = "up",
  delay = 0,
  duration = 0.6,
  className,
  once = true,
}: FadeInProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-80px" });
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const offset = directionOffsets[direction];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...offset }}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, ...offset }}
      transition={{
        duration,
        ease: [0.19, 1, 0.22, 1], // ease-out-expo
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
  once?: boolean;
}

/**
 * Container for staggered child animations.
 * Children should use StaggerItem for proper animation.
 *
 * @example
 * <Stagger staggerDelay={0.1}>
 *   <StaggerItem><Card>1</Card></StaggerItem>
 *   <StaggerItem><Card>2</Card></StaggerItem>
 *   <StaggerItem><Card>3</Card></StaggerItem>
 * </Stagger>
 */
export function Stagger({ children, staggerDelay = 0.08, className, once = true }: StaggerProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-80px" }}
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
        hidden: {},
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  direction?: Direction;
  className?: string;
}

/**
 * Individual item for staggered animations.
 * Must be used as a direct child of Stagger.
 *
 * @example
 * <Stagger>
 *   <StaggerItem direction="up">Item 1</StaggerItem>
 *   <StaggerItem direction="up">Item 2</StaggerItem>
 * </Stagger>
 */
export function StaggerItem({ children, direction = "up", className }: StaggerItemProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  const offset = directionOffsets[direction];

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, ...offset },
        visible: {
          opacity: 1,
          x: 0,
          y: 0,
          transition: {
            duration: 0.6,
            ease: [0.19, 1, 0.22, 1], // ease-out-expo
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface ScaleInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}

/**
 * Scale in animation when element scrolls into view.
 *
 * @example
 * <ScaleIn>
 *   <Card>Scales in when visible</Card>
 * </ScaleIn>
 */
export function ScaleIn({
  children,
  delay = 0,
  duration = 0.5,
  className,
  once = true,
}: ScaleInProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-80px" });
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
      transition={{
        duration,
        ease: [0.19, 1, 0.22, 1],
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface HoverScaleProps {
  children: React.ReactNode;
  scale?: number;
  className?: string;
}

/**
 * Subtle scale animation on hover.
 *
 * @example
 * <HoverScale>
 *   <Card>Scales on hover</Card>
 * </HoverScale>
 */
export function HoverScale({ children, scale = 1.02, className }: HoverScaleProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      whileHover={{ scale }}
      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Re-export of motion.div for custom animations.
 * Provides access to all framer-motion features.
 */
export const MotionDiv = motion.div;

/**
 * Animation variants for common patterns.
 */
export const animationVariants = {
  fadeInUp: {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.19, 1, 0.22, 1] },
    },
  },
  fadeInDown: {
    hidden: { opacity: 0, y: -40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.19, 1, 0.22, 1] },
    },
  },
  fadeInLeft: {
    hidden: { opacity: 0, x: 40 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: [0.19, 1, 0.22, 1] },
    },
  },
  fadeInRight: {
    hidden: { opacity: 0, x: -40 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: [0.19, 1, 0.22, 1] },
    },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.5, ease: [0.19, 1, 0.22, 1] },
    },
  },
};
