import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, CreditCard, History, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useCreditBalance } from "@/hooks/useCreditBalance";
import { useT } from "@/lib/i18n";

import { api } from "../../convex/_generated/api";

// Action badge colors
const ACTION_COLORS: Record<string, string> = {
  sentence: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  feedback: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  comprehension: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  audio: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  shadowing: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UsageHistoryPage() {
  const t = useT();
  const { user } = useAuth();
  const { used, remaining, limit, percentage, resetDate, tier } = useCreditBalance();

  const transactions = useQuery(
    api.subscriptions.getCreditTransactions,
    user?.id ? { userId: user.id, limit: 100 } : "skip"
  );

  const formattedResetDate = resetDate
    ? new Date(resetDate).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="container mx-auto max-w-4xl py-8">
      {/* Header with back button */}
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("usage.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("usage.subtitle")}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CreditCard className="text-muted-foreground h-5 w-5" />
              <span className="text-muted-foreground text-sm">{t("usage.creditsUsed")}</span>
            </div>
            <div className="mt-2 text-3xl font-bold">{used}</div>
            <p className="text-muted-foreground text-xs">{t("usage.thisMonth")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-muted-foreground h-5 w-5" />
              <span className="text-muted-foreground text-sm">{t("usage.creditsRemaining")}</span>
            </div>
            <div className="mt-2 text-3xl font-bold">{remaining}</div>
            <p className="text-muted-foreground text-xs">{t("usage.outOf", { limit })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <History className="text-muted-foreground h-5 w-5" />
              <span className="text-muted-foreground text-sm">{t("usage.actionsThisMonth")}</span>
            </div>
            <div className="mt-2 text-3xl font-bold">{transactions?.length ?? 0}</div>
            <p className="text-muted-foreground text-xs capitalize">{t(`usage.tier.${tier}`)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-sm">
            <span>
              {used} / {limit} {t("usage.credits")}
            </span>
            <span>{percentage}%</span>
          </div>
          <Progress value={percentage} className="mt-2" />
          <p className="text-muted-foreground mt-2 text-xs">
            {t("usage.resetsOn", { date: formattedResetDate })}
          </p>
          {tier === "free" && (
            <Button asChild className="mt-4" size="sm">
              <Link to="/pricing">{t("usage.upgradeForMore")}</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Transaction table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("usage.history")}</CardTitle>
          <CardDescription>{t("usage.historyDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {!transactions || transactions.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              {t("usage.noTransactions")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("usage.date")}</TableHead>
                  <TableHead>{t("usage.action")}</TableHead>
                  <TableHead>{t("usage.details")}</TableHead>
                  <TableHead className="text-right">{t("usage.credits")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx._id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(tx.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={ACTION_COLORS[tx.action] ?? "bg-gray-100"}
                      >
                        {t(`usage.actions.${tx.action}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {tx.metadata?.word ??
                        tx.metadata?.targetWord ??
                        tx.metadata?.text?.substring(0, 30) ??
                        "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {tx.creditsSpent === 0 ? (
                        <span className="text-green-600">
                          {t("usage.free")}
                          {tx.metadata?.adminBypass && ` (${t("usage.admin")})`}
                        </span>
                      ) : (
                        <span>{tx.creditsSpent}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
