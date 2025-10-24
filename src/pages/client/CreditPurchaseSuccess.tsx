import { DashboardLayout } from "@/components/DashboardLayout";
import { clientSidebarSections } from "@/config/navigation";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Wallet } from "lucide-react";
import { CreditWallet } from "@/components/CreditWallet";

export default function CreditPurchaseSuccess() {
  const [searchParams] = useSearchParams();
  const txRef = searchParams.get("tx_ref");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    // Invalidate queries to refresh wallet balance
    queryClient.invalidateQueries({ queryKey: ["credit_wallet"] });
    queryClient.invalidateQueries({ queryKey: ["credit_transactions"] });
  }, [queryClient]);

  return (
    <DashboardLayout sidebarSections={clientSidebarSections}>
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
              </div>
              
              <div>
                <h1 className="text-3xl font-bold text-green-900">Purchase Successful!</h1>
                <p className="text-muted-foreground mt-2">
                  Your credits have been added to your wallet
                </p>
              </div>

              {txRef && (
                <div className="text-xs text-muted-foreground bg-white/50 rounded px-3 py-2 inline-block">
                  Transaction Reference: {txRef}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <CreditWallet showActions={false} />

        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            onClick={() => navigate("/client/courses")}
            className="w-full"
          >
            <Wallet className="h-4 w-4 mr-2" />
            Browse Courses
          </Button>
          <Button
            onClick={() => navigate("/client")}
            className="w-full"
          >
            Go to Dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3">What's Next?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Your credits are now available in your wallet</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Browse courses and use credits to enroll</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Credits never expire - use them anytime</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
