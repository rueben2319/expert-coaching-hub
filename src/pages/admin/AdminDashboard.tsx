import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BookOpen, Users, Shield, DollarSign, TrendingUp, CreditCard, AlertCircle, Clock, ExternalLink, Copy } from "lucide-react";
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
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [totalCourses, setTotalCourses] = useState<number | null>(null);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<number | null>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [coachRevenue, setCoachRevenue] = useState<RevenueStats>({ daily: 0, monthly: 0, annual: 0 });
  const [creditRevenue, setCreditRevenue] = useState<RevenueStats>({ daily: 0, monthly: 0, annual: 0 });
  const [activeSubscriptions, setActiveSubscriptions] = useState<number>(0);
  const [graceSubscriptions, setGraceSubscriptions] = useState<number>(0);
  const [failedRenewalSubscriptions, setFailedRenewalSubscriptions] = useState<number>(0);
  const [renewalIssues, setRenewalIssues] = useState<any[]>([]);
  const [totalTransactions, setTotalTransactions] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        // Total users from profiles
        const usersCountRes = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        if (mounted) setTotalUsers(usersCountRes.count ?? 0);

        // Total courses
        const coursesCountRes = await supabase.from('courses').select('*', { count: 'exact', head: true });
        if (mounted) setTotalCourses(coursesCountRes.count ?? 0);

        // Pending withdrawals
        const withdrawalsCountRes = await supabase
          .from('withdrawal_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        if (mounted) setPendingWithdrawals(withdrawalsCountRes.count ?? 0);

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

        // Coach subscription revenue
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);

        // Coach subscriptions revenue (from transactions)
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

        // Recent users
        const { data: recent, error: recentErr } = await supabase
          .from('profiles')
          .select('id, full_name, email, created_at')
          .order('created_at', { ascending: false })
          .limit(6);
        if (recentErr) console.error('Error loading recent users', recentErr);

        if (recent && recent.length > 0) {
          const ids = recent.map((r: any) => r.id);
          const { data: roleRows, error: roleErr } = await supabase
            .from('user_roles')
            .select('user_id, role')
            .in('user_id', ids as string[]);
          if (roleErr) console.error('Error fetching roles for recent users', roleErr);
          const roleMap: Record<string, string> = {};
          (roleRows || []).forEach((row: any) => {
            roleMap[row.user_id] = row.role;
          });

          const enriched = recent.map((r: any) => ({ ...r, role: roleMap[r.id] || 'client' }));
          if (mounted) setRecentUsers(enriched);
        } else {
          if (mounted) setRecentUsers([]);
        }
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

  return (
    <DashboardLayout
      sidebarSections={adminSidebarSections}
      brandName="Admin Panel"
    >
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">Monitor and manage platform activity & revenue</p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Total Users</CardTitle>
            <CardDescription>Registered platform users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-primary">{loading ? '...' : totalUsers ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
              <BookOpen className="w-6 h-6 text-accent" />
            </div>
            <CardTitle>Total Courses</CardTitle>
            <CardDescription>Published courses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-accent">{loading ? '...' : totalCourses ?? 0}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
            <CardTitle>Active Subscriptions</CardTitle>
            <CardDescription>Coach subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-green-500">{loading ? '...' : activeSubscriptions}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-orange-500" />
            </div>
            <CardTitle>Pending Withdrawals</CardTitle>
            <CardDescription>Awaiting approval</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-orange-500">{loading ? '...' : pendingWithdrawals ?? 0}</div>
            <Button variant="outline" className="w-full mt-2" onClick={() => window.location.href = '/admin/withdrawals'}>
              Manage
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-amber-500" />
            </div>
            <CardTitle>Grace Period</CardTitle>
            <CardDescription>Renewals needing payment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-amber-600">{loading ? '...' : graceSubscriptions}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Failed Renewals</CardTitle>
            <CardDescription>Expired after attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2 text-destructive">{loading ? '...' : failedRenewalSubscriptions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Renewal Recovery */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Renewal Recovery Queue</CardTitle>
          <CardDescription>Links generated by auto-renewal that still require payment</CardDescription>
        </CardHeader>
        <CardContent>
          {renewalIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending or failed renewals at the moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Subscription</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {renewalIssues.map((issue) => {
                    const checkoutUrl = extractCheckoutUrl(issue.gateway_response);
                    return (
                      <tr key={issue.id} className="border-t">
                        <td className="py-2 pr-4 font-mono text-xs">
                          {issue.subscription_id || "—"}
                        </td>
                        <td className="py-2 pr-4 capitalize">
                          {issue.status}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {new Date(issue.created_at).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!checkoutUrl}
                            onClick={() => handleCopyCheckoutUrl(checkoutUrl)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy link
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!checkoutUrl}
                            onClick={() => checkoutUrl && window.open(checkoutUrl, "_blank", "noopener")}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Analytics */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Revenue Analytics</h2>
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annual">Annual</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-4 mt-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>Coach Subscriptions</CardTitle>
                  <CardDescription>Today's revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">
                    {loading ? '...' : formatCurrency(coachRevenue.daily)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                    <CreditCard className="w-6 h-6 text-accent" />
                  </div>
                  <CardTitle>Credit Purchases</CardTitle>
                  <CardDescription>Today's revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {loading ? '...' : formatCurrency(creditRevenue.daily)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  <CardTitle>Total Revenue</CardTitle>
                  <CardDescription>Today's total</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-500">
                    {loading ? '...' : formatCurrency(coachRevenue.daily + creditRevenue.daily)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="monthly" className="space-y-4 mt-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>Coach Subscriptions</CardTitle>
                  <CardDescription>This month's revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">
                    {loading ? '...' : formatCurrency(coachRevenue.monthly)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                    <CreditCard className="w-6 h-6 text-accent" />
                  </div>
                  <CardTitle>Credit Purchases</CardTitle>
                  <CardDescription>This month's revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {loading ? '...' : formatCurrency(creditRevenue.monthly)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  <CardTitle>Total Revenue</CardTitle>
                  <CardDescription>This month's total</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-500">
                    {loading ? '...' : formatCurrency(coachRevenue.monthly + creditRevenue.monthly)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="annual" className="space-y-4 mt-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle>Coach Subscriptions</CardTitle>
                  <CardDescription>This year's revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">
                    {loading ? '...' : formatCurrency(coachRevenue.annual)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                    <CreditCard className="w-6 h-6 text-accent" />
                  </div>
                  <CardTitle>Credit Purchases</CardTitle>
                  <CardDescription>This year's revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {loading ? '...' : formatCurrency(creditRevenue.annual)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  <CardTitle>Total Revenue</CardTitle>
                  <CardDescription>This year's total</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-500">
                    {loading ? '...' : formatCurrency(coachRevenue.annual + creditRevenue.annual)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage user roles and access</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => window.location.href = '/admin/users'}>
              Manage Users
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-accent" />
            </div>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>Total successful transactions: {totalTransactions}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Monitor all platform transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Users */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Users</h2>
        <div className="overflow-x-auto">
          {recentUsers.length === 0 ? (
            <div className="text-muted-foreground">No recent users</div>
          ) : (
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="text-left text-sm text-muted-foreground border-b">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted-foreground/5">
                    <td className="py-3 px-4 align-top">{u.full_name || 'Unnamed'}</td>
                    <td className="py-3 px-4 align-top text-sm text-muted-foreground">{u.email}</td>
                    <td className="py-3 px-4 align-top text-sm">{u.role}</td>
                    <td className="py-3 px-4 align-top text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 align-top text-sm">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/users/${u.id}`)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
