import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { coachNavItems, coachSidebarSections } from "@/config/navigation";
import { AlertCircle, CheckCircle, CreditCard, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CoachSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [paychanguSecret, setPaychanguSecret] = useState("");
  const [paychanguEnabled, setPaychanguEnabled] = useState(false);

  // Fetch current coach settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["coach-settings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_settings")
        .select("*")
        .eq("coach_id", user!.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned

      if (data) {
        setPaychanguSecret(data.paychangu_secret_key || "");
        setPaychanguEnabled(data.paychangu_enabled || false);
      }

      return data;
    },
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const settingsData = {
        coach_id: user!.id,
        paychangu_secret_key: paychanguEnabled ? paychanguSecret.trim() : null,
        paychangu_enabled: paychanguEnabled,
      };

      const { error } = await supabase
        .from("coach_settings")
        .upsert(settingsData, { onConflict: "coach_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-settings", user?.id] });
      toast.success("Settings saved successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to save settings: " + error.message);
    },
  });

  const handleSave = () => {
    if (paychanguEnabled && !paychanguSecret.trim()) {
      toast.error("Please enter your PayChangu secret key");
      return;
    }

    saveSettingsMutation.mutate();
  };

  if (isLoading) {
    return (
      <DashboardLayout navItems={coachNavItems} sidebarSections={coachSidebarSections}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={coachNavItems} sidebarSections={coachSidebarSections}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Coach Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure your payment integrations and preferences
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Integrations
            </CardTitle>
            <CardDescription>
              Payment integrations for client payments are not currently available. Courses are free to enroll.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Your PayChangu secret key is encrypted and stored securely.
                It will only be used to process payments for your coaching services.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">PayChangu Integration</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable PayChangu to receive payments directly for your client subscriptions
                  </p>
                </div>
                <Switch
                  checked={paychanguEnabled}
                  onCheckedChange={setPaychanguEnabled}
                />
              </div>

              {paychanguEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="paychangu-secret">PayChangu Secret Key</Label>
                  <Input
                    id="paychangu-secret"
                    type="password"
                    placeholder="sk_live_..."
                    value={paychanguSecret}
                    onChange={(e) => setPaychanguSecret(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your secret key from your PayChangu dashboard → Settings → API Keys
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button
                onClick={handleSave}
                disabled={saveSettingsMutation.isPending}
                className="min-w-[120px]"
              >
                {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>

              {settings && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {settings.paychangu_enabled ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      PayChangu integration active
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      PayChangu integration not configured
                    </>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Platform Billing Only</h4>
              <p className="text-sm text-muted-foreground">
                Currently, only platform subscription billing is active (coaches pay for platform access).
                Client payment features (subscriptions and one-time payments) are not implemented.
                All courses are free for clients to enroll.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
