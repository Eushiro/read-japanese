import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  StopCircle,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

function formatTimestamp(timestamp?: number) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString();
}

function formatCost(cost?: number) {
  if (cost === undefined) return "-";
  return `$${cost.toFixed(4)}`;
}

export function JobsPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const jobs = useQuery(api.batchJobs.list, { limit: 50 });
  const cancelJob = useMutation(api.batchJobs.cancel);

  const isLoading = jobs === undefined;

  // Auto-refresh every 5 seconds if there are running jobs
  useEffect(() => {
    if (!autoRefresh || !jobs) return;

    const hasActiveJobs = jobs.some((j) => j.status === "running" || j.status === "submitted");

    if (hasActiveJobs) {
      const interval = setInterval(() => {
        // Query will auto-refresh due to Convex reactivity
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, jobs]);

  const handleCancel = async (jobId: Id<"batchJobs">) => {
    if (confirm("Are you sure you want to cancel this job?")) {
      await cancelJob({ jobId });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "succeeded":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "submitted":
        return <Clock className="w-4 h-4 text-amber-500" />;
      case "cancelled":
        return <StopCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      succeeded: "default",
      failed: "destructive",
      running: "secondary",
      submitted: "outline",
      cancelled: "outline",
      pending: "outline",
    };
    return (
      <Badge variant={variants[status] ?? "outline"} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Batch Jobs</h1>
          <p className="text-foreground-muted">Monitor content generation jobs</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            Auto-refresh
          </label>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      {jobs && (
        <div className="flex gap-4 text-sm">
          <span>
            Active: {jobs.filter((j) => j.status === "running" || j.status === "submitted").length}
          </span>
          <span className="text-green-600">
            Succeeded: {jobs.filter((j) => j.status === "succeeded").length}
          </span>
          <span className="text-red-600">
            Failed: {jobs.filter((j) => j.status === "failed").length}
          </span>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Deck</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!jobs || jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-foreground-muted">
                    No batch jobs found
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => {
                  const progressPct =
                    job.itemCount > 0 ? Math.round((job.processedCount / job.itemCount) * 100) : 0;

                  return (
                    <TableRow key={job._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          {getStatusBadge(job.status)}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{job.jobType}</TableCell>
                      <TableCell>{job.deckId ?? "-"}</TableCell>
                      <TableCell className="text-xs font-mono">{job.model}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 w-32">
                          <Progress value={progressPct} className="h-2" />
                          <span className="text-xs text-foreground-muted">
                            {job.processedCount}/{job.itemCount}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {job.actualCost !== undefined ? (
                            <span className="text-green-600">{formatCost(job.actualCost)}</span>
                          ) : (
                            <span className="text-foreground-muted">
                              Est: {formatCost(job.estimatedCost)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-foreground-muted">
                        {formatTimestamp(job.createdAt)}
                      </TableCell>
                      <TableCell>
                        {(job.status === "running" || job.status === "submitted") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(job._id)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <StopCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
