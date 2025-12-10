import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DollarSign, TrendingUp, AlertCircle, Clock, ExternalLink, Copy, Wallet, CheckCircle, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { adminSidebarSections } from "@/config/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface RevenueStats {
  daily: number;
  monthly: number;
  annual: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [coachRevenue, setCoachRevenue] = useState<RevenueStats>({ daily: 0, monthly: 0, annual: 0 });
  const [creditRevenue, setCreditRevenue] = useState<RevenueStats>({ daily: 0, monthly: 0, annual: 0 });
  const [activeSubscriptions, setActiveSubscriptions] = useState<number>(0);
  const [graceSubscriptions, setGraceSubscriptions] = useState<number>(0);
  const [failedRenewalSubscriptions, setFailedRenewalSubscriptions] = useState<number>(0);
  const [renewalIssues, setRenewalIssues] = useState<any[]>([]);
  const [totalTransactions, setTotalTransactions] = useState<number>(0);
  const [totalCreditsInCirculation, setTotalCreditsInCirculation] = useState<number>(0);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<number>(0);
  const [processingWithdrawals, setProcessingWithdrawals] = useState<number>(0);
  const [failedTransactions, setFailedTransactions] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        // Pending withdrawals
        const withdrawalsCountRes = await supabase
          .from('withdrawal_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        if (mounted) setPendingWithdrawals(withdrawalsCountRes.count ?? 0);

        // Processing withdrawals
        const { count: processingCount } = await supabase
          .from('withdrawal_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'processing');
        if (mounted) setProcessingWithdrawals(processingCount ?? 0);

        // Active coach subscriptions
        const activeSubsRes = await supabase
          .from('coach_subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');
        if (mounted) setActiveSubscriptions(activeSubsRes.count ?? 0);

        const graceSubsRes = await supabase
          .from('coach_subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'grace');
        if (mounted) setGraceSubscriptions(graceSubsRes.count ?? 0);

        const failedRenewalsRes = await supabase
          .from('coach_subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'expired')
          .gt('failed_renewal_attempts', 0);
        if (mounted) setFailedRenewalSubscriptions(failedRenewalsRes.count ?? 0);

        const { data: renewalRows, error: renewalErr } = await supabase
          .from('transactions')
          .select('id, subscription_id, transaction_ref, status, created_at, gateway_response')
          .eq('transaction_mode', 'coach_subscription_renewal')
          .in('status', ['pending', 'failed'])
          .order('created_at', { ascending: false })
          .limit(10);

        if (renewalErr) {
          console.error('Error loading renewal issues', renewalErr);
        } else if (mounted) {
          setRenewalIssues(renewalRows || []);
        }

        // Revenue calculations
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);

        // Coach subscriptions revenue
        const { data: coachTxns } = await supabase
          .from('transactions')
          .select('amount, created_at')
          .eq('transaction_mode', 'coach_subscription')
          .eq('status', 'success');

        if (coachTxns && mounted) {
          const daily = coachTxns
            .filter(t => new Date(t.created_at) >= today)
            .reduce((sum, t) => sum + Number(t.amount), 0);
          const monthly = coachTxns
            .filter(t => new Date(t.created_at) >= monthStart)
            .reduce((sum, t) => sum + Number(t.amount), 0);
          const annual = coachTxns
            .filter(t => new Date(t.created_at) >= yearStart)
            .reduce((sum, t) => sum + Number(t.amount), 0);
          setCoachRevenue({ daily, monthly, annual });
        }

        // Credit purchases revenue
        const { data: creditTxns } = await supabase
          .from('transactions')
          .select('amount, created_at')
          .eq('transaction_mode', 'credit_purchase')
          .eq('status', 'success');

        if (creditTxns && mounted) {
          const daily = creditTxns
            .filter(t => new Date(t.created_at) >= today)
            .reduce((sum, t) => sum + Number(t.amount), 0);
          const monthly = creditTxns
            .filter(t => new Date(t.created_at) >= monthStart)
            .reduce((sum, t) => sum + Number(t.amount), 0);
          const annual = creditTxns
            .filter(t => new Date(t.created_at) >= yearStart)
            .reduce((sum, t) => sum + Number(t.amount), 0);
          setCreditRevenue({ daily, monthly, annual });
        }

        // Total successful transactions
        const { count: txnCount } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'success');
        if (mounted) setTotalTransactions(txnCount ?? 0);

        // Failed transactions (last 30 days)
        const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        const { count: failedCount } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed')
          .gte('created_at', thirtyDaysAgo.toISOString());
        if (mounted) setFailedTransactions(failedCount ?? 0);

        // Total credits in circulation
        const { data: walletData } = await supabase
          .from('credit_wallets')
          .select('balance');
        const totalCredits = (walletData || []).reduce((sum: number, w: any) => sum + Number(w.balance), 0);
        if (mounted) setTotalCreditsInCirculation(totalCredits);

      } catch (e) {
        console.error('Error loading admin stats', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MW', { 
      style: 'currency', 
      currency: 'MWK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const extractCheckoutUrl = (gatewayResponse: any): string | null => {
    return (
      gatewayResponse?.data?.checkout_url ||
      gatewayResponse?.checkout_url ||
      gatewayResponse?.data?.data?.checkout_url ||
      null
    );
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

  const totalRevenue = {
    daily: coachRevenue.daily + creditRevenue.daily,
    monthly: coachRevenue.monthly + creditRevenue.monthly,
    annual: coachRevenue.annual + creditRevenue.annual,
  };

  return (
    <DashboardLayout
      sidebarSections={adminSidebarSections}
      brandName="Admin Panel"
    >
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">Revenue overview and action items</p>
      </div>

      {/* Quick Links */}
      <div className="grid gap-3 md:grid-cols-4 mb-8">
        <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate('/admin/users')}>
          <div className="text-left">
            <p className="font-medium">User Analytics</p>
            <p className="text-xs text-muted-foreground">Demographics & trends</p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4" />
        </Button>
        <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate('/admin/courses')}>
          <div className="text-left">
            <p className="font-medium">Course Analytics</p>
            <p className="text-xs text-muted-foreground">Stats & insights</p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4" />
        </Button>
        <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate('/admin/transactions')}>
          <div className="text-left">
            <p className="font-medium">Transactions</p>
            <p className="text-xs text-muted-foreground">Payment history</p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4" />
        </Button>
        <Button variant="outline" className="justify-start h-auto py-3" onClick={() => navigate('/admin/system-health')}>
          <div className="text-left">
            <p className="font-medium">System Health</p>
            <p className="text-xs text-muted-foreground">Technical metrics</p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4" />
        </Button>
      </div>

      {/* Attention Required */}
      {((pendingWithdrawals ?? 0) > 0 || (processingWithdrawals ?? 0) > 0 || graceSubscriptions > 0 || failedRenewalSubscriptions > 0 || failedTransactions > 0) && (
        <>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Attention Required
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {(pendingWithdrawals ?? 0) > 0 && (
              <Card className="border-orange-500 border-2 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Clock className="w-5 h-5 text-orange-500" />
                    <span className="text-xs text-muted-foreground">Needs action</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-500">{pendingWithdrawals}</div>
                  <p className="text-xs text-muted-foreground">Pending Withdrawals</p>
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/admin/withdrawals')}>
                    Review
                  </Button>
                </CardContent>
              </Card>
            )}

            {(processingWithdrawals ?? 0) > 0 && (
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Clock className="w-5 h-5 text-blue-500" />
                    <span className="text-xs text-muted-foreground">In progress</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-500">{processingWithdrawals}</div>
                  <p className="text-xs text-muted-foreground">Processing Withdrawals</p>
                </CardContent>
              </Card>
            )}

            {graceSubscriptions > 0 && (
              <Card className="border-yellow-500 border hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <span className="text-xs text-muted-foreground">Grace period</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-500">{graceSubscriptions}</div>
                  <p className="text-xs text-muted-foreground">Subscriptions in Grace</p>
                </CardContent>
              </Card>
            )}

            {failedTransactions > 0 && (
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-xs text-muted-foreground">Last 30 days</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">{failedTransactions}</div>
                  <p className="text-xs text-muted-foreground">Failed Transactions</p>
                  <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/admin/transactions')}>
                    View
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Revenue Overview */}
      <h2 className="text-xl font-semibold mb-4">Revenue Overview</h2>
      <Tabs defaultValue="total" className="mb-8">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="total">Total</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="credits">Credits</TabsTrigger>
        </TabsList>
        
        <TabsContent value="total" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <DollarSign className="w-5 h-5 text-green-500" />
                  <span className="text-xs text-muted-foreground">Today</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{loading ? '...' : formatCurrency(totalRevenue.daily)}</div>
                <p className="text-xs text-muted-foreground">Daily Revenue</p>
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
                <div className="text-2xl font-bold text-blue-500">{loading ? '...' : formatCurrency(totalRevenue.monthly)}</div>
                <p className="text-xs text-muted-foreground">Monthly Revenue</p>
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
                <div className="text-2xl font-bold text-purple-500">{loading ? '...' : formatCurrency(totalRevenue.annual)}</div>
                <p className="text-xs text-muted-foreground">Annual Revenue</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <DollarSign className="w-5 h-5 text-green-500" />
                  <span className="text-xs text-muted-foreground">Today</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? '...' : formatCurrency(coachRevenue.daily)}</div>
                <p className="text-xs text-muted-foreground">Coach Subscriptions</p>
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
                <div className="text-2xl font-bold">{loading ? '...' : formatCurrency(coachRevenue.monthly)}</div>
                <p className="text-xs text-muted-foreground">Coach Subscriptions</p>
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
                <div className="text-2xl font-bold">{loading ? '...' : formatCurrency(coachRevenue.annual)}</div>
                <p className="text-xs text-muted-foreground">Coach Subscriptions</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="credits" className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <DollarSign className="w-5 h-5 text-green-500" />
                  <span className="text-xs text-muted-foreground">Today</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? '...' : formatCurrency(creditRevenue.daily)}</div>
                <p className="text-xs text-muted-foreground">Credit Purchases</p>
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
                <div className="text-2xl font-bold">{loading ? '...' : formatCurrency(creditRevenue.monthly)}</div>
                <p className="text-xs text-muted-foreground">Credit Purchases</p>
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
                <div className="text-2xl font-bold">{loading ? '...' : formatCurrency(creditRevenue.annual)}</div>
                <p className="text-xs text-muted-foreground">Credit Purchases</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Financial Health */}
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
            <div className="text-2xl font-bold text-green-500">{loading ? '...' : activeSubscriptions}</div>
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
            <div className="text-2xl font-bold text-indigo-500">{loading ? '...' : totalCreditsInCirculation.toLocaleString()}</div>
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
            <div className="text-2xl font-bold text-emerald-500">{loading ? '...' : totalTransactions}</div>
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
            <div className="text-2xl font-bold text-orange-500">{loading ? '...' : failedRenewalSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Expired Subscriptions</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Renewal Issues */}
      {renewalIssues.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <CardTitle>Subscription Renewal Issues</CardTitle>
            </div>
            <CardDescription>
              Pending or failed renewal transactions that may need attention
            </CardDescription>
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
                  {renewalIssues.map((issue: any) => {
                    const checkoutUrl = extractCheckoutUrl(issue.gateway_response);
                    return (
                      <tr key={issue.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-3">{new Date(issue.created_at).toLocaleDateString()}</td>
                        <td className="py-2 px-3 font-mono text-xs">{issue.transaction_ref}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            issue.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {issue.status}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {checkoutUrl && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => window.open(checkoutUrl, '_blank')}>
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
