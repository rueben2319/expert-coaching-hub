import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight } from "lucide-react";
import { coachNavItems, coachSidebarSections } from "@/config/navigation";

const BillingSuccess = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');

  const tx_ref = searchParams.get('tx_ref');
  const status_param = searchParams.get('status');

  useEffect(() => {
    // Check payment status from URL parameters
    if (status_param === 'successful' || status_param === 'success' || status_param === 'completed') {
      setStatus('success');
    } else if (status_param === 'failed' || status_param === 'cancelled') {
      setStatus('failed');
    } else {
      // If no status provided, assume success for now (could add backend verification)
      setStatus('success');
    }
  }, [status_param]);

  if (status === 'loading') {
    return (
      <DashboardLayout navItems={coachNavItems} sidebarSections={coachSidebarSections}>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Verifying payment...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (status === 'failed') {
    return (
      <DashboardLayout navItems={coachNavItems} sidebarSections={coachSidebarSections}>
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-red-600">Payment Failed</CardTitle>
              <CardDescription>
                Your payment could not be processed. Please try again or contact support.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              {tx_ref && (
                <p className="text-sm text-muted-foreground">
                  Transaction Reference: {tx_ref}
                </p>
              )}
              <div className="flex gap-4 justify-center">
                <Button asChild variant="outline">
                  <Link to="/billing">Try Again</Link>
                </Button>
                <Button asChild>
                  <Link to="/dashboard">Go to Dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={coachNavItems} sidebarSections={coachSidebarSections}>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-600">Payment Successful!</CardTitle>
            <CardDescription>
              Welcome to your new subscription plan. Your account has been upgraded and you now have access to all premium features.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            {tx_ref && (
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Transaction Details</p>
                <p className="font-mono text-sm">Reference: {tx_ref}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="text-left">
                <h3 className="font-semibold mb-2">What's Next:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ArrowRight className="w-4 h-4 mt-0.5 text-green-600" />
                    Your subscription is now active
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="w-4 h-4 mt-0.5 text-green-600" />
                    Check your email for invoice details
                  </li>
                  <li className="flex items-start gap-2">
                    <ArrowRight className="w-4 h-4 mt-0.5 text-green-600" />
                    Access all premium features immediately
                  </li>
                </ul>
              </div>

              <div className="flex gap-4 justify-center pt-4">
                <Button asChild variant="outline">
                  <Link to="/coach/billing">View Billing Details</Link>
                </Button>
                <Button asChild>
                  <Link to="/coach">Get Started</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BillingSuccess;
