import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { clientNavItems, clientSidebarSections } from "@/config/navigation";

interface CoachPackage {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  max_clients: number | null;
  coach_id: string;
  coach_name?: string;
  coach_email?: string;
}

const ClientPackages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const { data: packages, isLoading } = useQuery({
    queryKey: ["coach_packages_public"],
    queryFn: async () => {
      // First get active packages
      const { data: packagesData, error: packagesError } = await supabase
        .from("coach_packages")
        .select("*")
        .eq("is_active", true);

      if (packagesError) throw packagesError;

      // Get coach profiles for the packages
      const coachIds = [...new Set(packagesData?.map(p => p.coach_id) || [])];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", coachIds);

      if (profilesError) throw profilesError;

      // Combine package data with coach info
      const packagesWithCoaches = packagesData?.map(pkg => ({
        ...pkg,
        coach_name: profiles?.find(p => p.id === pkg.coach_id)?.full_name || "Unknown Coach",
        coach_email: profiles?.find(p => p.id === pkg.coach_id)?.email || "",
      })) as CoachPackage[];

      return packagesWithCoaches;
    },
  });

  const { data: currentSubscriptions } = useQuery({
    queryKey: ["client_subscriptions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_subscriptions")
        .select("package_id, status")
        .eq("client_id", user!.id);

      if (error) throw error;
      return data || [];
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: async ({ packageId, billingCycle }: { packageId: string; billingCycle: "monthly" | "yearly" }) => {
      const selectedPackage = packages?.find(p => p.id === packageId);
      if (!selectedPackage) throw new Error("Package not found");

      // Create payment link for client subscription
      const { data, error } = await supabase.functions.invoke("create-payment-link", {
        body: {
          mode: "client_subscription",
          coach_id: selectedPackage.coach_id,
          billing_cycle: billingCycle,
          amount: billingCycle === "monthly" ? selectedPackage.price_monthly : selectedPackage.price_yearly,
          package_id: packageId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    },
    onError: (error: any) => {
      toast.error("Failed to start subscription: " + error.message);
    },
  });

  const handleSubscribe = (packageId: string) => {
    if (!user) {
      toast.error("Please log in to subscribe");
      return;
    }

    subscribeMutation.mutate({ packageId, billingCycle });
  };

  const isSubscribedToPackage = (packageId: string) => {
    return currentSubscriptions?.some(sub => sub.package_id === packageId && sub.status === 'active');
  };

  return (
    <DashboardLayout navItems={clientNavItems} sidebarSections={clientSidebarSections}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Coach Packages</h1>
            <p className="text-muted-foreground">Subscribe to premium coaching packages from expert coaches</p>
          </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-3 text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-muted-foreground">Loading packages...</p>
            </div>
          ) : packages?.length === 0 ? (
            <div className="col-span-3 text-center py-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-lg font-medium">No packages available</h3>
                    <p className="text-muted-foreground mt-2">Coaches haven't published any subscription packages yet. Check back later!</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            packages?.map((pkg) => (
              <Card key={pkg.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{pkg.name}</CardTitle>
                    {isSubscribedToPackage(pkg.id) && (
                      <Badge variant="default" className="bg-green-600">Subscribed</Badge>
                    )}
                  </div>
                  <CardDescription>
                    by {pkg.coach_name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold">
                      MWK {billingCycle === "monthly" ? pkg.price_monthly.toLocaleString() : pkg.price_yearly.toLocaleString()}
                      <span className="text-sm font-normal text-muted-foreground"> / {billingCycle}</span>
                      {billingCycle === "yearly" && (() => {
                        const monthlyPrice = pkg.price_monthly;
                        const calculatedYearlyPrice = monthlyPrice * 12;
                        const discount = calculatedYearlyPrice - pkg.price_yearly;
                        if (discount > 0) {
                          const savingsPercent = Math.round((discount / calculatedYearlyPrice) * 100);
                          return (
                            <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              Save {savingsPercent}%
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {pkg.description && (
                      <p className="text-sm text-muted-foreground">{pkg.description}</p>
                    )}

                    {pkg.max_clients && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Max clients:</span>
                        <span>{pkg.max_clients}</span>
                      </div>
                    )}
                  </div>

                  {pkg.features.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Includes:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {pkg.features.slice(0, 4).map((feature, idx) => (
                          <li key={idx}>• {feature}</li>
                        ))}
                        {pkg.features.length > 4 && (
                          <li className="text-muted-foreground">• +{pkg.features.length - 4} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isSubscribedToPackage(pkg.id) ? "outline" : "default"}
                    onClick={() => handleSubscribe(pkg.id)}
                    disabled={subscribeMutation.isPending}
                  >
                    {isSubscribedToPackage(pkg.id) ? "Manage Subscription" : "Subscribe Now"}
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ClientPackages;
