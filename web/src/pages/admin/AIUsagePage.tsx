import { useQuery } from "convex/react";
import {
  Activity,
  AlertCircle,
  DollarSign,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { api } from "../../../convex/_generated/api";

export function AIUsagePage() {
  const [days, setDays] = useState(30);
  const stats = useQuery(api.aiUsage.getStats, { days });

  if (stats === undefined) {
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const { totals, byAction, byModel, topUsers, dailyCosts } = stats;

  // Calculate daily average
  const dailyAvg = totals.costCents / days;

  // Get sorted daily costs for chart
  const sortedDays = Object.entries(dailyCosts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14); // Last 14 days

  const maxDailyCost = Math.max(...sortedDays.map(([, cost]) => cost), 1);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Usage & Costs</h1>
          <p className="text-foreground-muted">Monitor AI API usage and estimated costs</p>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-foreground-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totals.costDollars.toFixed(2)}</div>
            <p className="text-xs text-foreground-muted">
              ~${dailyAvg.toFixed(1)}¢/day avg
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted">API Calls</CardTitle>
            <Activity className="h-4 w-4 text-foreground-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.calls.toLocaleString()}</div>
            <p className="text-xs text-foreground-muted">
              {totals.failedCalls > 0 ? (
                <span className="text-red-500">{totals.failedCalls} failed</span>
              ) : (
                <span className="text-emerald-500">100% success</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted">Total Tokens</CardTitle>
            <Zap className="h-4 w-4 text-foreground-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.tokens > 1_000_000
                ? `${(totals.tokens / 1_000_000).toFixed(1)}M`
                : totals.tokens > 1_000
                  ? `${(totals.tokens / 1_000).toFixed(1)}K`
                  : totals.tokens}
            </div>
            <p className="text-xs text-foreground-muted">
              ~{Math.round(totals.tokens / Math.max(totals.calls, 1))} per call
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground-muted">Avg Cost/Call</CardTitle>
            <TrendingUp className="h-4 w-4 text-foreground-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.avgCostPerCall < 1
                ? `${(totals.avgCostPerCall * 100).toFixed(2)}¢`
                : `$${(totals.avgCostPerCall / 100).toFixed(3)}`}
            </div>
            <p className="text-xs text-foreground-muted">per API call</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Cost Chart */}
      {sortedDays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Daily Costs (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {sortedDays.map(([date, cost]) => {
                const height = (cost / maxDailyCost) * 100;
                const dateObj = new Date(date);
                const dayLabel = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                return (
                  <div
                    key={date}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${date}: $${(cost / 100).toFixed(2)}`}
                  >
                    <div
                      className="w-full bg-accent/80 rounded-t hover:bg-accent transition-colors"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                    <span className="text-[10px] text-foreground-muted">{dayLabel}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage by Action & Model */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Action */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Usage by Action</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(byAction).length === 0 ? (
              <p className="text-foreground-muted text-sm">No data yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(byAction)
                  .sort((a, b) => b[1].costCents - a[1].costCents)
                  .map(([action, data]) => (
                    <div key={action} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-accent" />
                        <span className="text-sm font-medium">{formatAction(action)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium">
                          ${(data.costCents / 100).toFixed(2)}
                        </span>
                        <span className="text-xs text-foreground-muted ml-2">
                          ({data.calls} calls)
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Model */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Usage by Model</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(byModel).length === 0 ? (
              <p className="text-foreground-muted text-sm">No data yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(byModel)
                  .sort((a, b) => b[1].costCents - a[1].costCents)
                  .map(([model, data]) => (
                    <div key={model} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-sm font-medium">{formatModel(model)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium">
                          ${(data.costCents / 100).toFixed(2)}
                        </span>
                        <span className="text-xs text-foreground-muted ml-2">
                          ({data.calls} calls)
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Users */}
      {topUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Users by Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topUsers.slice(0, 5).map((user, i) => (
                <div key={user.userId} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-foreground-muted text-sm w-6">#{i + 1}</span>
                    <span className="text-sm font-mono truncate max-w-48">
                      {user.userId === "system" ? "System" : user.userId.slice(0, 20)}...
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    ${(user.costCents / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {totals.calls === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-foreground-muted mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No AI Usage Data</h3>
            <p className="text-foreground-muted text-center max-w-sm">
              AI usage will be tracked here once users start generating sentences and using AI
              features.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatModel(model: string): string {
  // "google/gemini-3-flash-preview" -> "Gemini 3 Flash"
  const parts = model.split("/");
  const modelName = parts[parts.length - 1];
  return modelName
    .replace(/-/g, " ")
    .replace(/preview/gi, "")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
