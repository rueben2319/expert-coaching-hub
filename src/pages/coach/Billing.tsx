import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePayments } from "@/hooks/usePayments";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { coachSidebarSections } from "@/config/navigation";
import { AlertCircle, Clock, Loader2 } from "lucide-react";

const CoachBilling = () => {
  const { user } = useAuth();
  const { createCoachSubscription, cancelCoachSubscription } = usePayments();
  const queryClient = useQueryClient();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [showPlans, setShowPlans] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Invalidate subscription data on component mount to ensure fresh data
  useEffect(() => {
    const invalidateData = async () => {
      // Small delay to ensure webhook has completed
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (user?.id) {
        console.log("Invalidating cache for user:", user.id);
        await queryClient.invalidateQueries({ queryKey: ["coach_subscription", user.id] });
        await queryClient.invalidateQueries({ queryKey: ["invoices", user.id] });
        console.log("Cache invalidated");
      }
    };

    invalidateData();
  }, [user?.id, queryClient]);

  const { data: tiers, isLoading: tiersLoading } = useQuery({
    queryKey: ["tiers"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("tiers").select("id, name, description, price_monthly, price_yearly, features, is_active").eq("is_active", true).order("price_monthly");
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error("Error fetching tiers:", e);
        return [];
      }
    },
  });

  const { data: currentSub, isLoading: subLoading } = useQuery({
    queryKey: ["coach_subscription", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("coach_subscriptions")
          .select("id, status, tier_id, billing_cycle, start_date, renewal_date, grace_expires_at, failed_renewal_attempts")
          .eq("coach_id", user!.id)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        console.log("Fetched subscription data:", data);
        return data;
      } catch (e) {
        console.error("Error fetching subscription:", e);
        return null;
      }
    },
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["invoices", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("invoices")
          .select("id, invoice_number, amount, currency, status, invoice_date, description")
          .eq("user_id", user!.id)
          .order("invoice_date", { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error("Error fetching invoices:", e);
        return [];
      }
    },
  });

  const cancelSubscription = useMutation({
    mutationFn: async () => {
      if (!currentSub?.id) {
        throw new Error("No active subscription found");
      }
      return await cancelCoachSubscription(currentSub.id, cancelReason || undefined, true);
    },
    onSuccess: () => {
      toast.success("Subscription cancelled successfully");
      setCancelDialogOpen(false);
      setCancelReason("");
      queryClient.invalidateQueries({ queryKey: ["coach_subscription", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["invoices", user?.id] });
    },
    onError: (error: any) => {
      console.error("Error cancelling subscription:", error);
      toast.error(error?.message || "Failed to cancel subscription");
    },
  });

  const handleChangeBillingCycle = async () => {
    if (!currentSub) return;

    try {
      const newCycle = currentSub.billing_cycle === "monthly" ? "yearly" : "monthly";
      const now = new Date();
      const renewal = new Date(now);

      if (newCycle === "yearly") {
        renewal.setFullYear(now.getFullYear() + 1);
      } else {
        renewal.setMonth(now.getMonth() + 1);
      }

      const { error } = await supabase
        .from("coach_subscriptions")
        .update({
          billing_cycle: newCycle,
          renewal_date: renewal.toISOString()
        })
        .eq("id", currentSub.id);

      if (error) throw error;

      toast.success(`Billing cycle changed to ${newCycle}`);
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["coach_subscription", user?.id] });
    } catch (e: any) {
      console.error("Error changing billing cycle:", e);
      toast.error("Failed to change billing cycle");
    }
  };

  const handleUpdatePaymentMethod = async () => {
    // For now, just show a message that this feature is coming soon
    // In a full implementation, this would integrate with PayChangu's saved payment methods
    toast.info("Payment method update coming soon - please contact support");
  };

  const handleSubscribe = async (tierId: string) => {
    console.log("handleSubscribe called with tierId:", tierId, "billingCycle:", billingCycle);
    if (!tierId) {
      console.error("No tierId provided");
      toast.error("Please select a subscription plan");
      return;
    }
    try {
      const { checkout_url } = await createCoachSubscription(tierId, billingCycle);
      window.location.href = checkout_url;
    } catch (e: any) {
      console.error("Error creating subscription:", e);
      toast.error(e.message || "Failed to start checkout");
    }
  };

  const isActiveSubscription = currentSub && currentSub.status === 'active';

  const formatDateTime = (dateValue?: string | null) => {
    if (!dateValue) return null;
    return new Date(dateValue).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const statusLabels: Record<string, string> = {
    active: "Active",
    pending: "Pending payment",
    cancelled: "Cancelled",
    expired: "Expired",
    grace: "Grace period",
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "grace":
        return "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100";
      case "pending":
        return "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100";
      case "expired":
      case "cancelled":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-foreground";
    }
  };

  const currentStatusLabel = currentSub ? statusLabels[currentSub.status] || currentSub.status : null;
  const graceExpiresFormatted = formatDateTime(currentSub?.grace_expires_at);
  const renewalDateFormatted = formatDateTime(currentSub?.renewal_date);
  const failedAttempts = currentSub?.failed_renewal_attempts ?? 0;
  const showGraceAlert = currentSub?.status === "grace";
  const showPendingAlert = currentSub?.status === "pending";

  return (
    <DashboardLayout sidebarSections={coachSidebarSections}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Billing & Subscriptions</h1>
          <RadioGroup value={billingCycle} onValueChange={(v) => setBillingCycle(v as any)} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="monthly" id="monthly" />
              <Label htmlFor="monthly">Monthly</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yearly" id="yearly" />
              <Label htmlFor="yearly">Yearly</Label>
            </div>
          </RadioGroup>
        </div>

        {showGraceAlert && (
          <Alert className="border-amber-500/60 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Payment required</AlertTitle>
            <AlertDescription>
              We tried to renew your subscription but the payment failed. Premium access continues until{" "}
              <span className="font-semibold">{graceExpiresFormatted || "grace period ends"}</span>. Please update your
              payment method or repurchase the plan to avoid interruption.
            </AlertDescription>
          </Alert>
        )}

        {showPendingAlert && (
          <Alert className="bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Pending confirmation</AlertTitle>
            <AlertDescription>
              Your subscription is currently awaiting payment confirmation. If you already paid, this will update
              automatically once the provider notifies us.
            </AlertDescription>
          </Alert>
        )}

        {currentSub && (
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                Status:
                <Badge className={getStatusBadgeClass(currentSub.status)}>
                  {currentStatusLabel}
                </Badge>
                {failedAttempts > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Failed renewals: {failedAttempts}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Billing cycle: {currentSub.billing_cycle}</div>
              {renewalDateFormatted && (
                <div className="text-sm text-muted-foreground">
                  Renews on: {renewalDateFormatted}
                </div>
              )}
              {currentSub.status === "grace" && graceExpiresFormatted && (
                <div className="text-sm text-muted-foreground">
                  Grace access ends: {graceExpiresFormatted}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isActiveSubscription ? (
          // Management interface for active subscriptions
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Manage Subscription</CardTitle>
                  <CardDescription>Update your billing preferences or cancel your subscription</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Billing Cycle</div>
                      <div className="text-sm text-muted-foreground">Currently: {currentSub?.billing_cycle}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleChangeBillingCycle}>
                      Change Cycle
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Payment Method</div>
                      <div className="text-sm text-muted-foreground">PayChangu</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleUpdatePaymentMethod}>
                      Update
                    </Button>
                  </div>
                </CardContent>
                <CardFooter>
                  <AlertDialog
                    open={cancelDialogOpen}
                    onOpenChange={(open) => {
                      setCancelDialogOpen(open);
                      if (!open) {
                        setCancelReason("");
                      }
                    }}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full"
                        disabled={cancelSubscription.isPending}
                        aria-busy={cancelSubscription.isPending}
                        aria-live="polite"
                      >
                        {cancelSubscription.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            Cancelling...
                          </>
                        ) : (
                          "Cancel Subscription"
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This immediately stops future billing and limits access to premium coach features.
                          You can resubscribe later at any time.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-2">
                        <Label htmlFor="cancel-reason">Cancellation reason (optional)</Label>
                        <Textarea
                          id="cancel-reason"
                          value={cancelReason}
                          onChange={(event) => setCancelReason(event.target.value)}
                          placeholder="Let us know why you're leaving..."
                          aria-describedby="cancel-reason-helper"
                          minLength={0}
                        />
                        <p id="cancel-reason-helper" className="text-sm text-muted-foreground">
                          Feedback helps us improve the coach experience.
                        </p>
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={cancelSubscription.isPending}>Keep subscription</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(event) => {
                            event.preventDefault();
                            if (!cancelSubscription.isPending) {
                              cancelSubscription.mutate();
                            }
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={cancelSubscription.isPending}
                        >
                          {cancelSubscription.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                              Cancelling...
                            </>
                          ) : (
                            "Confirm cancellation"
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Change Plan</CardTitle>
                  <CardDescription>Upgrade or downgrade your subscription plan</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Want to upgrade to a higher tier or switch to a different plan?
                    </p>
                    <Button className="w-full" onClick={() => setShowPlans(!showPlans)}>
                      {showPlans ? "Hide Available Plans" : "View Available Plans"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {showPlans && (
              <>
                <div className="border-t pt-6">
                  <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {tiersLoading ? (
                      <div className="col-span-3 text-center py-8">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                        <p className="mt-4 text-muted-foreground">Loading subscription plans...</p>
                      </div>
                    ) : tiers?.length === 0 ? (
                      <div className="col-span-3 text-center py-8 text-muted-foreground">
                        No subscription plans available.
                      </div>
                    ) : (
                      tiers?.map((tier: any) => (
                        <Card key={tier.id} className={currentSub?.tier_id === tier.id ? "ring-2 ring-primary" : ""}>
                          <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                              {tier.name}
                              {currentSub?.tier_id === tier.id && (
                                <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">Current Plan</span>
                              )}
                            </CardTitle>
                            {tier.description && <CardDescription>{tier.description}</CardDescription>}
                          </CardHeader>
                          <CardContent>
                            <div className="text-3xl font-bold">
                              {billingCycle === "monthly" ? tier.price_monthly : tier.price_yearly}
                              <span className="text-base font-normal text-muted-foreground"> / {billingCycle}</span>
                            </div>
                            {Array.isArray(tier.features) && (
                              <ul className="mt-4 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                                {tier.features.map((f: any, idx: number) => (
                                  <li key={idx}>{String(f)}</li>
                                ))}
                              </ul>
                            )}
                          </CardContent>
                          <CardFooter>
                            <Button
                              className="w-full"
                              variant={currentSub?.tier_id === tier.id ? "outline" : "default"}
                              onClick={() => handleSubscribe(tier.id)}
                            >
                              {currentSub?.tier_id === tier.id ? "Current Plan" : "Change Plan"}
                            </Button>
                          </CardFooter>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          // Subscription tiers for new/past subscribers
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tiersLoading ? (
              <div className="col-span-3 text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="mt-4 text-muted-foreground">Loading subscription plans...</p>
              </div>
            ) : tiers?.length === 0 ? (
              <div className="col-span-3 text-center py-8 text-muted-foreground">
                No subscription plans available.
              </div>
            ) : (
              tiers?.map((tier: any) => (
                <Card key={tier.id}>
                  <CardHeader>
                    <CardTitle>{tier.name}</CardTitle>
                    {tier.description && <CardDescription>{tier.description}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {billingCycle === "monthly" ? tier.price_monthly : tier.price_yearly}
                      <span className="text-base font-normal text-muted-foreground"> / {billingCycle}</span>
                    </div>
                    {Array.isArray(tier.features) && (
                      <ul className="mt-4 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                        {tier.features.map((f: any, idx: number) => (
                          <li key={idx}>{String(f)}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" onClick={() => handleSubscribe(tier.id)}>
                      {currentSub?.tier_id === tier.id ? "Manage" : "Choose Plan"}
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoicesLoading ? (
                <div className="text-center py-4">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading invoices...</p>
                </div>
              ) : invoices?.length === 0 ? (
                <div className="text-sm text-muted-foreground">No invoices yet.</div>
              ) : (
                invoices?.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium">{inv.invoice_number}</div>
                      <div className="text-sm text-muted-foreground">{inv.description || "Payment"}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{inv.amount} {inv.currency}</div>
                      <div className="text-xs text-muted-foreground">{new Date(inv.invoice_date).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CoachBilling;
