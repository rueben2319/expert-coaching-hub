import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePayments } from "@/hooks/usePayments";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { isBuilderPreview } from "@/lib/builderPreview";

const MOCK_TIERS = [
  { id: "tier_starter", name: "Starter", description: "Basic features", price_monthly: 10, price_yearly: 100, features: ["1 course", "Basic analytics"], is_active: true },
  { id: "tier_pro", name: "Pro", description: "Most popular", price_monthly: 30, price_yearly: 300, features: ["10 courses", "Advanced analytics"], is_active: true },
  { id: "tier_premium", name: "Premium", description: "All features", price_monthly: 100, price_yearly: 1000, features: ["Unlimited courses", "Priority support"], is_active: true },
];

const MOCK_INVOICES = [
  { id: "inv_1", invoice_number: "INV-1001", amount: 30, currency: "USD", status: "paid", invoice_date: new Date().toISOString(), description: "Pro plan" },
  { id: "inv_2", invoice_number: "INV-1002", amount: 100, currency: "USD", status: "paid", invoice_date: new Date().toISOString(), description: "Premium plan" },
];

const MOCK_SUB = { id: "sub_1", status: "active", tier_id: "tier_pro", billing_cycle: "monthly", start_date: new Date().toISOString(), renewal_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString() };

const CoachBilling = () => {
  const { user } = useAuth();
  const { createCoachSubscription } = usePayments();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const builder = isBuilderPreview();

  const { data: tiers } = useQuery({
    queryKey: ["tiers"],
    enabled: !builder,
    queryFn: async () => {
      const { data, error } = await supabase.from("tiers").select("id, name, description, price_monthly, price_yearly, features, is_active").eq("is_active", true).order("price_monthly");
      if (error) throw error;
      return data || [];
    },
    initialData: builder ? MOCK_TIERS : undefined,
  });

  const { data: currentSub } = useQuery({
    queryKey: ["coach_subscription", user?.id],
    enabled: !builder && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_subscriptions")
        .select("id, status, tier_id, billing_cycle, start_date, renewal_date")
        .eq("coach_id", user!.id)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    initialData: builder ? MOCK_SUB : undefined,
  });

  const { data: invoices } = useQuery({
    queryKey: ["invoices", user?.id],
    enabled: !builder && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, amount, currency, status, invoice_date, description")
        .eq("user_id", user!.id)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    initialData: builder ? MOCK_INVOICES : undefined,
  });

  const handleSubscribe = async (tierId: string) => {
    try {
      if (builder) {
        toast.success("Builder preview: simulated checkout started");
        return;
      }
      const { checkout_url } = await createCoachSubscription(tierId, billingCycle);
      window.location.href = checkout_url;
    } catch (e: any) {
      toast.error(e.message || "Failed to start checkout");
    }
  };

  return (
    <DashboardLayout>
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

        {currentSub && (
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Status: {currentSub.status}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Billing cycle: {currentSub.billing_cycle}</div>
              {currentSub.renewal_date && (
                <div className="text-sm text-muted-foreground">Renews on: {new Date(currentSub.renewal_date).toLocaleDateString()}</div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers?.map((tier: any) => (
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
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoices?.map((inv: any) => (
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
              ))}
              {invoices?.length === 0 && <div className="text-sm text-muted-foreground">No invoices yet.</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CoachBilling;
