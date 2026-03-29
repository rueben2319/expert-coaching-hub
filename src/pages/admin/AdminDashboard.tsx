import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TrendingUp, AlertCircle, ExternalLink, Copy, Wallet, CheckCircle } from "lucide-react";
import { adminSidebarSections } from "@/config/navigation";
import { toast } from "sonner";
import { useAdminOverviewData } from "@/hooks/useAdminOverviewData";
import { AttentionRequiredGrid } from "@/components/admin/AttentionRequiredGrid";
import { RevenueTabs } from "@/components/admin/RevenueTabs";
import { QuickLinksRow } from "@/components/admin/QuickLinksRow";

interface RenewalIssue {
  id: string;
  subscription_id: string | null;
  transaction_ref: string | null;
  status: string;
  created_at: string;
  gateway_response: unknown;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { data: overviewData, sections } = useAdminOverviewData();

  const [loadingFinancialHealth, setLoadingFinancialHealth] = useState(true);
  const [totalTransactions, setTotalTransactions] = useState<number>(0);
  const [totalCreditsInCirculation, setTotalCreditsInCirculation] = useState<number>(0);
  const [renewalIssues, setRenewalIssues] = useState<RenewalIssue[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoadingFinancialHealth(true);
      try {
        const [{ count: txnCount }, walletsResult, renewalResult] = await Promise.all([
          supabase.from("transactions").select("*", { count: "exact", head: true }).eq("status", "success"),
          supabase.from("credit_wallets").select("balance"),
          supabase
            .from("transactions")
            .select("id, subscription_id, transaction_ref, status, created_at, gateway_response")
            .eq("transaction_mode", "coach_subscription_renewal")
            .in("status", ["pending", "failed"])
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        if (!mounted) return;

        setTotalTransactions(txnCount ?? 0);
        setTotalCreditsInCirculation(
          (walletsResult.data || []).reduce((sum: number, wallet: { balance: number }) => sum + Number(wallet.balance), 0),
        );

        if (renewalResult.error) {
          console.error("Error loading renewal issues", renewalResult.error);
        } else {
          setRenewalIssues(renewalResult.data || []);
        }
      } catch (e) {
        console.error("Error loading admin financial stats", e);
      } finally {
        if (mounted) setLoadingFinancialHealth(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-MW", {
      style: "currency",
      currency: "MWK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const extractCheckoutUrl = (gatewayResponse: unknown): string | null => {
    if (!gatewayResponse || typeof gatewayResponse !== "object") return null;
    const response = gatewayResponse as {
      checkout_url?: string;
      data?: { checkout_url?: string; data?: { checkout_url?: string } };
    };

    return response.data?.checkout_url || response.checkout_url || response.data?.data?.checkout_url || null;
  };

  const handleCopyCheckoutUrl = async (url: string | null) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Renewal link copied to clipboard");
    } catch (error) {
      console.error("Failed to copy renewal link", error);
      toast.error("Failed to copy link");
    }
  };

  return (
    <DashboardLayout sidebarSections={adminSidebarSections} brandName="Admin Panel">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Admin Dashboard</h1>
        <p className="text-muted-foreground">Revenue overview and action items</p>
      </div>

      <QuickLinksRow onNavigate={navigate} />

      <AttentionRequiredGrid
        data={overviewData}
        isLoading={sections.attention.isLoading}
        isError={sections.attention.isError}
        onRetry={sections.attention.retry}
        onNavigate={navigate}
      />

      <h2 className="text-xl font-semibold mb-4">Revenue Overview</h2>
      <RevenueTabs
        revenue={overviewData.revenue}
        isLoading={sections.revenue.isLoading}
        isError={sections.revenue.isError}
        onRetry={sections.revenue.retry}
        formatCurrency={formatCurrency}
      />

      <h2 className="text-xl font-semibold mb-4">Financial Health</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{loadingFinancialHealth ? "..." : overviewData.subscriptions.active}</div>
            <p className="text-xs text-muted-foreground">Coach Subscriptions</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Wallet className="w-5 h-5 text-indigo-500" />
              <span className="text-xs text-muted-foreground">In wallets</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-500">{loadingFinancialHealth ? "..." : totalCreditsInCirculation.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Credits in Circulation</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Successful</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{loadingFinancialHealth ? "..." : totalTransactions}</div>
            <p className="text-xs text-muted-foreground">Total Transactions</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              <span className="text-xs text-muted-foreground">Failed renewals</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{loadingFinancialHealth ? "..." : overviewData.subscriptions.failedRenewals}</div>
            <p className="text-xs text-muted-foreground">Expired Subscriptions</p>
          </CardContent>
        </Card>
      </div>

      {renewalIssues.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <CardTitle>Subscription Renewal Issues</CardTitle>
            </div>
            <CardDescription>Pending or failed renewal transactions that may need attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full table-auto border-collapse text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Transaction Ref</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {renewalIssues.map((issue) => {
                    const checkoutUrl = extractCheckoutUrl(issue.gateway_response);
                    return (
                      <tr key={issue.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3">{new Date(issue.created_at).toLocaleDateString()}</td>
                        <td className="py-2 px-3 font-mono text-xs">{issue.transaction_ref}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              issue.status === "failed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {issue.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {checkoutUrl && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => window.open(checkoutUrl, "_blank")}>
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleCopyCheckoutUrl(checkoutUrl)}>
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
