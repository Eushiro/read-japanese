import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

interface AudioWaveformProps {
  analyserNode: AnalyserNode | null;
  className?: string;
  /** Height of the waveform canvas */
  height?: number;
  /** Width of the waveform canvas */
  width?: number;
}

/**
 * Real-time audio waveform visualization using canvas.
 * Displays a flowing wave line that responds to audio input.
 */
export function AudioWaveform({
  analyserNode,
  className,
  height = 64,
  width = 280,
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyserNode.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    // Set up canvas for high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      analyserNode.getByteTimeDomainData(dataArray);

      // Clear canvas with transparent background
      ctx.clearRect(0, 0, width, height);

      // Create gradient for the wave line
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "rgba(255, 132, 0, 0.6)");
      gradient.addColorStop(0.5, "rgba(254, 237, 122, 0.8)");
      gradient.addColorStop(1, "rgba(255, 132, 0, 0.6)");

      // Draw the waveform
      ctx.lineWidth = 3;
      ctx.strokeStyle = gradient;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          // Use quadratic curves for smoother lines
          const prevX = x - sliceWidth;
          const prevV = dataArray[i - 1] / 128.0;
          const prevY = (prevV * height) / 2;
          const midX = (prevX + x) / 2;
          const midY = (prevY + y) / 2;
          ctx.quadraticCurveTo(prevX, prevY, midX, midY);
        }

        x += sliceWidth;
      }

      ctx.stroke();

      // Draw a subtle glow effect
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(255, 132, 0, 0.15)";
      ctx.beginPath();
      x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevX = x - sliceWidth;
          const prevV = dataArray[i - 1] / 128.0;
          const prevY = (prevV * height) / 2;
          const midX = (prevX + x) / 2;
          const midY = (prevY + y) / 2;
          ctx.quadraticCurveTo(prevX, prevY, midX, midY);
        }

        x += sliceWidth;
      }

      ctx.stroke();
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, width, height]);

  if (!analyserNode) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none", className)}
      style={{ width, height }}
    />
  );
}
