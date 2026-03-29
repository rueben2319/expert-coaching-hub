import { AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AdminOverviewDTO } from "@/hooks/useAdminOverviewData";

interface AttentionRequiredGridProps {
  data: AdminOverviewDTO;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onNavigate: (path: string) => void;
}

export function AttentionRequiredGrid({ data, isLoading, isError, onRetry, onNavigate }: AttentionRequiredGridProps) {
  if (isLoading) {
    return (
      <Card className="mb-8">
        <CardContent className="py-6 text-sm text-muted-foreground">Loading attention-required metrics...</CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="mb-8">
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground mb-3">Unable to load attention-required metrics.</p>
          <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const hasItems =
    data.withdrawals.pending > 0 ||
    data.withdrawals.processing > 0 ||
    data.subscriptions.grace > 0 ||
    data.subscriptions.failedRenewals > 0 ||
    data.failedTransactions.last30Days > 0;

  if (!hasItems) return null;

  return (
    <>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-orange-500" />
        Attention Required
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {data.withdrawals.pending > 0 && (
          <Card className="border-orange-500 border-2 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Clock className="w-5 h-5 text-orange-500" />
                <span className="text-xs text-muted-foreground">Needs action</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{data.withdrawals.pending}</div>
              <p className="text-xs text-muted-foreground">Pending Withdrawals</p>
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => onNavigate("/admin/withdrawals")}>
                Review
              </Button>
            </CardContent>
          </Card>
        )}

        {data.withdrawals.processing > 0 && (
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Clock className="w-5 h-5 text-blue-500" />
                <span className="text-xs text-muted-foreground">In progress</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{data.withdrawals.processing}</div>
              <p className="text-xs text-muted-foreground">Processing Withdrawals</p>
            </CardContent>
          </Card>
        )}

        {data.subscriptions.grace > 0 && (
          <Card className="border-yellow-500 border hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                <span className="text-xs text-muted-foreground">Grace period</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{data.subscriptions.grace}</div>
              <p className="text-xs text-muted-foreground">Subscriptions in Grace</p>
            </CardContent>
          </Card>
        )}

        {data.failedTransactions.last30Days > 0 && (
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-xs text-muted-foreground">Last 30 days</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{data.failedTransactions.last30Days}</div>
              <p className="text-xs text-muted-foreground">Failed Transactions</p>
              <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => onNavigate("/admin/transactions")}>
                View
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
