import { useQuery } from "convex/react";
import {
  BarChart3,
  CheckCircle2,
  HardDrive,
  Image,
  Music,
  RefreshCw,
  Terminal,
  TrendingDown,
} from "lucide-react";
import React, { useState } from "react";
import { Bar, BarChart, Cell, Legend, Pie, PieChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

import { api } from "../../../convex/_generated/api";

// Chart config type (defined locally to avoid module resolution issues)
type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<string, string> });
};

// Format bytes to human-readable
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const chartConfig = {
  wav: { label: "WAV", color: "#ef4444" },
  mp3: { label: "MP3", color: "#22c55e" },
  png: { label: "PNG", color: "#f97316" },
  webp: { label: "WebP", color: "#06b6d4" },
  jpg: { label: "JPG", color: "#8b5cf6" },
  audio: { label: "Audio", color: "#8b5cf6" },
  images: { label: "Images", color: "#06b6d4" },
  current: { label: "Current", color: "#ef4444" },
  projected: { label: "After Compression", color: "#22c55e" },
} satisfies ChartConfig;

export function MediaPage() {
  const stats = useQuery(api.admin.getMediaStats, {});
  const [showCommand, setShowCommand] = useState(false);

  const isLoading = stats === undefined;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Media Management</h1>
          <p className="text-foreground-muted">
            Monitor and optimize audio/image files stored in R2
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-4">
            {/* Total Files */}
            <div className="p-6 border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Total Files</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </div>

            {/* Current Size */}
            <div className="p-6 border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Current Size (est.)</p>
                  <p className="text-2xl font-bold">{formatBytes(stats.sizes.current.total)}</p>
                </div>
              </div>
            </div>

            {/* After Compression */}
            <div className="p-6 border rounded-lg bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">After Compression</p>
                  <p className="text-2xl font-bold">
                    {formatBytes(stats.sizes.afterCompression.total)}
                  </p>
                </div>
              </div>
            </div>

            {/* Potential Savings */}
            <div className="p-6 border rounded-lg bg-card border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Potential Savings</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatBytes(stats.sizes.savings.bytes)}
                  </p>
                  <p className="text-xs text-green-600">
                    ({stats.sizes.savings.percent}% reduction)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Format Distribution Pie Chart */}
            <div className="p-6 border rounded-lg bg-card">
              <h3 className="font-semibold mb-4">File Format Distribution</h3>
              {stats.chartData.formatDistribution.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <PieChart>
                    <Pie
                      data={stats.chartData.formatDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {stats.chartData.formatDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name, props) => [
                            `${value} files (${formatBytes(props.payload.size)})`,
                            name,
                          ]}
                        />
                      }
                    />
                    <Legend />
                  </PieChart>
                </ChartContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-foreground-muted">
                  No files to display
                </div>
              )}
            </div>

            {/* Size Comparison Bar Chart */}
            <div className="p-6 border rounded-lg bg-card">
              <h3 className="font-semibold mb-4">Size Comparison (MB)</h3>
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={stats.chartData.compressionComparison}>
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `${value.toFixed(1)}`} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [`${Number(value).toFixed(2)} MB`]}
                      />
                    }
                  />
                  <Legend />
                  <Bar dataKey="audio" name="Audio" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="images" name="Images" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </div>

          {/* Size by Format Table */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Audio Formats */}
            <div className="p-6 border rounded-lg bg-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Music className="w-4 h-4" />
                Audio Files ({stats.audio.total})
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span>WAV (uncompressed)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold">
                      {stats.sizes.byFormat.wav.count}
                    </span>
                    <span className="text-foreground-muted ml-2">
                      ({formatBytes(stats.sizes.byFormat.wav.size)})
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>MP3 (compressed)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold">
                      {stats.sizes.byFormat.mp3.count}
                    </span>
                    <span className="text-foreground-muted ml-2">
                      ({formatBytes(stats.sizes.byFormat.mp3.size)})
                    </span>
                  </div>
                </div>
                {stats.audio.uncompressed > 0 && (
                  <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      {stats.audio.uncompressed} WAV files → MP3 would save{" "}
                      <span className="font-bold">
                        {formatBytes(
                          stats.sizes.byFormat.wav.size - stats.sizes.byFormat.wav.count * 35 * 1024
                        )}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Image Formats */}
            <div className="p-6 border rounded-lg bg-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Image className="w-4 h-4" />
                Image Files ({stats.images.total})
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500" />
                    <span>PNG (uncompressed)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold">
                      {stats.sizes.byFormat.png.count}
                    </span>
                    <span className="text-foreground-muted ml-2">
                      ({formatBytes(stats.sizes.byFormat.png.size)})
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-cyan-500" />
                    <span>WebP (compressed)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold">
                      {stats.sizes.byFormat.webp.count}
                    </span>
                    <span className="text-foreground-muted ml-2">
                      ({formatBytes(stats.sizes.byFormat.webp.size)})
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span>JPG (compressed)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold">
                      {stats.sizes.byFormat.jpg.count}
                    </span>
                    <span className="text-foreground-muted ml-2">
                      ({formatBytes(stats.sizes.byFormat.jpg.size)})
                    </span>
                  </div>
                </div>
                {stats.images.uncompressed > 0 && (
                  <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      {stats.images.uncompressed} PNG files → WebP would save{" "}
                      <span className="font-bold">
                        {formatBytes(
                          stats.sizes.byFormat.png.size - stats.sizes.byFormat.png.count * 60 * 1024
                        )}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Compression Action */}
          {(stats.audio.uncompressed > 0 || stats.images.uncompressed > 0) && (
            <div className="p-6 border rounded-lg bg-card">
              <h3 className="font-semibold mb-2">Run Compression</h3>
              <p className="text-sm text-foreground-muted mb-4">
                Compression requires ffmpeg (audio) and sharp (images) which can't run in serverless
                environments. Run the script locally:
              </p>

              <Button
                variant="outline"
                onClick={() => setShowCommand(!showCommand)}
                className="mb-4"
              >
                <Terminal className="w-4 h-4 mr-2" />
                {showCommand ? "Hide" : "Show"} Command
              </Button>

              {showCommand && (
                <div className="space-y-4">
                  <div className="p-4 bg-zinc-900 text-zinc-100 rounded-lg font-mono text-sm overflow-x-auto">
                    <p className="text-zinc-500"># Install dependencies (first time only)</p>
                    <p>brew install ffmpeg</p>
                    <p className="mt-2 text-zinc-500"># Set environment variables</p>
                    <p>export VITE_CONVEX_URL=$(grep VITE_CONVEX_URL .env.local | cut -d'=' -f2)</p>
                    <p>export R2_ACCOUNT_ID="d0acc0753376ff22ad54c9231eb994d1"</p>
                    <p>export R2_ACCESS_KEY_ID="your_key"</p>
                    <p>export R2_SECRET_ACCESS_KEY="your_secret"</p>
                    <p>export R2_BUCKET_NAME="sanlang-media"</p>
                    <p>export R2_PUBLIC_URL="https://pub-xxx.r2.dev"</p>
                    <p className="mt-2 text-zinc-500"># Run compression</p>
                    <p>cd web && npx tsx scripts/compressMedia.ts</p>
                    <p className="mt-2 text-zinc-500"># Or compress only audio/images</p>
                    <p>npx tsx scripts/compressMedia.ts --type audio</p>
                    <p>npx tsx scripts/compressMedia.ts --type image</p>
                    <p className="mt-2 text-zinc-500"># Preview without changes</p>
                    <p>npx tsx scripts/compressMedia.ts --dry-run</p>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      <strong>What the script does:</strong>
                    </p>
                    <ul className="text-sm text-blue-700 dark:text-blue-400 list-disc list-inside mt-2">
                      <li>Downloads uncompressed files from R2</li>
                      <li>Converts WAV → MP3 (128kbps) and PNG → WebP (quality 80)</li>
                      <li>Uploads compressed files to R2</li>
                      <li>Updates URLs in the database</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* All Optimized */}
          {stats.audio.uncompressed === 0 && stats.images.uncompressed === 0 && (
            <div className="p-6 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-800 dark:text-green-400">
                    All files optimized!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-500">
                    All audio and image files are already in compressed formats. Total storage:{" "}
                    {formatBytes(stats.sizes.current.total)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
