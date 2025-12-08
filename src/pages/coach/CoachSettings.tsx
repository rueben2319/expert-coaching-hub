import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { coachSidebarSections } from "@/config/navigation";
import { Settings, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CoachSettings() {
  return (
    <DashboardLayout sidebarSections={coachSidebarSections}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Coach Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure your preferences and integrations
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Platform Information
            </CardTitle>
            <CardDescription>
              Current platform capabilities and billing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Platform Billing Only:</strong> Currently, only platform subscription billing is active (coaches pay for platform access).
                Client payment features are not implemented. All courses are free for clients to enroll.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h4 className="font-medium">How It Works</h4>
              <p className="text-sm text-muted-foreground">
                As a coach, you pay a subscription fee to access the platform and create courses.
                Students can enroll in your courses for free using the credit system.
                Payment integrations for direct client payments may be added in the future.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
