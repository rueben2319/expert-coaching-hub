import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RevenueAggregates } from "@/hooks/useAdminOverviewData";

interface RevenueTabsProps {
  revenue: RevenueAggregates;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  formatCurrency: (amount: number) => string;
}

export function RevenueTabs({ revenue, isLoading, isError, onRetry, formatCurrency }: RevenueTabsProps) {
  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="py-4 text-sm text-muted-foreground">Loading revenue metrics...</CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="mb-6">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground mb-3">Unable to load revenue aggregates.</p>
          <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const renderCards = (stats: { daily: number; monthly: number; annual: number }, label: string) => (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
      <Card className="hover:shadow-md transition-all hover:scale-[1.02]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Today</span>
          </div>
          <div className="text-xl font-bold text-green-500">{formatCurrency(stats.daily)}</div>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
      <Card className="hover:shadow-md transition-all hover:scale-[1.02]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">This month</span>
          </div>
          <div className="text-xl font-bold text-blue-500">{formatCurrency(stats.monthly)}</div>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
      <Card className="hover:shadow-md transition-all hover:scale-[1.02]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-4 h-4 text-purple-500" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">This year</span>
          </div>
          <div className="text-xl font-bold text-purple-500">{formatCurrency(stats.annual)}</div>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Tabs defaultValue="total" className="mb-6">
      <TabsList className="grid w-full max-w-md grid-cols-3 h-8">
        <TabsTrigger value="total" className="text-xs">Total</TabsTrigger>
        <TabsTrigger value="subscriptions" className="text-xs">Subscriptions</TabsTrigger>
        <TabsTrigger value="credits" className="text-xs">Credits</TabsTrigger>
      </TabsList>

      <TabsContent value="total" className="mt-3">
        {renderCards(revenue.total, "Revenue")}
      </TabsContent>

      <TabsContent value="subscriptions" className="mt-3">
        {renderCards(revenue.coachSubscriptions, "Coach Subscriptions")}
      </TabsContent>

      <TabsContent value="credits" className="mt-3">
        {renderCards(revenue.creditPurchases, "Credit Purchases")}
      </TabsContent>
    </Tabs>
  );
}
