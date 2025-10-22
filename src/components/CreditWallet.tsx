import { useCredits } from "@/hooks/useCredits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Plus, ArrowDownToLine, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface CreditWalletProps {
  showActions?: boolean;
  compact?: boolean;
}

export function CreditWallet({ showActions = true, compact = false }: CreditWalletProps) {
  const { balance, totalEarned, totalSpent, walletLoading } = useCredits();
  const navigate = useNavigate();

  if (walletLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
        <Wallet className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold">{balance}</span>
        <span className="text-sm text-muted-foreground">Credits</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Credit Wallet
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Available Balance</p>
            <p className="text-4xl font-bold text-primary">{balance.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">Credits</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                <p className="text-xs">Total Earned</p>
              </div>
              <p className="text-lg font-semibold text-green-600">{totalEarned.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <TrendingDown className="h-3 w-3" />
                <p className="text-xs">Total Spent</p>
              </div>
              <p className="text-lg font-semibold text-orange-600">{totalSpent.toFixed(2)}</p>
            </div>
          </div>

          {showActions && (
            <div className="flex gap-2 pt-4">
              <Button 
                className="flex-1"
                onClick={() => navigate("/client/credits")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Buy Credits
              </Button>
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate("/coach/withdrawals")}
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                Withdraw
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
