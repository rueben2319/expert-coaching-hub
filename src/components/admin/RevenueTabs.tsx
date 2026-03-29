import { DollarSign, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
      <Card className="mb-8">
        <CardContent className="py-6 text-sm text-muted-foreground">Loading revenue metrics...</CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="mb-8">
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground mb-3">Unable to load revenue aggregates.</p>
          <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const renderCards = (stats: { daily: number; monthly: number; annual: number }, label: string) => (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <DollarSign className="w-5 h-5 text-green-500" />
            <span className="text-xs text-muted-foreground">Today</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-500">{formatCurrency(stats.daily)}</div>
          <p className="text-xs text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <span className="text-xs text-muted-foreground">This month</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-500">{formatCurrency(stats.monthly)}</div>
          <p className="text-xs text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            <span className="text-xs text-muted-foreground">This year</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-500">{formatCurrency(stats.annual)}</div>
          <p className="text-xs text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <Tabs defaultValue="total" className="mb-8">
      <TabsList className="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="total">Total</TabsTrigger>
        <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        <TabsTrigger value="credits">Credits</TabsTrigger>
      </TabsList>

      <TabsContent value="total" className="mt-4">
        {renderCards(revenue.total, "Revenue")}
      </TabsContent>

      <TabsContent value="subscriptions" className="mt-4">
        {renderCards(revenue.coachSubscriptions, "Coach Subscriptions")}
      </TabsContent>

      <TabsContent value="credits" className="mt-4">
        {renderCards(revenue.creditPurchases, "Credit Purchases")}
      </TabsContent>
    </Tabs>
  );
}
