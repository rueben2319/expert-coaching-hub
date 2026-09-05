import { AlertCircle, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <Card className="mb-6">
        <CardContent className="py-4 text-sm text-muted-foreground">Loading attention-required metrics...</CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="mb-6">
        <CardContent className="py-4">
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
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-orange-500" />
        Attention Required
      </h2>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {data.withdrawals.pending > 0 && (
          <Card className="border-orange-500/50 border-2 hover:shadow-md transition-all hover:scale-[1.02] hover:border-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Needs action</span>
              </div>
              <div className="text-xl font-bold text-orange-500">{data.withdrawals.pending}</div>
              <p className="text-[10px] text-muted-foreground mb-2">Pending Withdrawals</p>
              <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => onNavigate("/admin/withdrawals")}>
                Review <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {data.withdrawals.processing > 0 && (
          <Card className="border-blue-500/30 border hover:shadow-md transition-all hover:scale-[1.02] hover:border-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">In progress</span>
              </div>
              <div className="text-xl font-bold text-blue-500">{data.withdrawals.processing}</div>
              <p className="text-[10px] text-muted-foreground">Processing Withdrawals</p>
            </CardContent>
          </Card>
        )}

        {data.subscriptions.grace > 0 && (
          <Card className="border-yellow-500/30 border hover:shadow-md transition-all hover:scale-[1.02] hover:border-yellow-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Grace period</span>
              </div>
              <div className="text-xl font-bold text-yellow-500">{data.subscriptions.grace}</div>
              <p className="text-[10px] text-muted-foreground">Subscriptions in Grace</p>
            </CardContent>
          </Card>
        )}

        {data.failedTransactions.last30Days > 0 && (
          <Card className="border-red-500/30 border hover:shadow-md transition-all hover:scale-[1.02] hover:border-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Last 30 days</span>
              </div>
              <div className="text-xl font-bold text-red-500">{data.failedTransactions.last30Days}</div>
              <p className="text-[10px] text-muted-foreground mb-2">Failed Transactions</p>
              <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => onNavigate("/admin/transactions")}>
                View <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
