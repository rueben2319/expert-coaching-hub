import { useCredits } from "@/hooks/useCredits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, ShoppingCart, GraduationCap, ArrowDownToLine, Plus, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export function CreditTransactions() {
  const { transactions, transactionsLoading } = useCredits();

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "purchase":
        return <Plus className="h-4 w-4 text-green-600" />;
      case "course_payment":
        return <ShoppingCart className="h-4 w-4 text-orange-600" />;
      case "course_earning":
        return <GraduationCap className="h-4 w-4 text-blue-600" />;
      case "withdrawal":
        return <ArrowDownToLine className="h-4 w-4 text-purple-600" />;
      case "refund":
        return <ArrowUpRight className="h-4 w-4 text-green-600" />;
      default:
        return <ArrowDownRight className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTransactionColor = (amount: number) => {
    return amount > 0 ? "text-green-600" : "text-red-600";
  };

  const formatTransactionType = (type: string) => {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  if (transactionsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>
          View all your credit transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transactions && transactions.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {getTransactionIcon(tx.transaction_type)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {formatTransactionType(tx.transaction_type)}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {tx.reference_type || "system"}
                        </Badge>
                      </div>
                      {tx.description && (
                        <p className="text-xs text-muted-foreground">
                          {tx.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Balance: {Number(tx.balance_before).toFixed(2)}</span>
                        <span>→</span>
                        <span>{Number(tx.balance_after).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${getTransactionColor(Number(tx.amount))}`}>
                      {Number(tx.amount) > 0 ? "+" : ""}
                      {Number(tx.amount).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">Credits</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No transactions yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
