import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { coachNavItems, coachSidebarSections } from "@/config/navigation";
import { useCredits } from "@/hooks/useCredits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, Wallet, Clock, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { CreditWallet } from "@/components/CreditWallet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WITHDRAWAL_LIMITS } from "@/lib/withdrawalLimits";

const CONVERSION_RATE = WITHDRAWAL_LIMITS.CONVERSION_RATE; // 1 credit = 100 MWK
const MIN_WITHDRAWAL = WITHDRAWAL_LIMITS.MIN_WITHDRAWAL; // Minimum 10 credits
const MAX_WITHDRAWAL = WITHDRAWAL_LIMITS.MAX_WITHDRAWAL; // Maximum credits per transaction
const DAILY_LIMIT = WITHDRAWAL_LIMITS.DAILY_LIMIT; // Maximum credits per day
const CREDIT_AGING_DAYS = WITHDRAWAL_LIMITS.CREDIT_AGING_DAYS; // Credits must age 3 days

export default function Withdrawals() {
  const { balance, requestWithdrawal, withdrawalRequests, withdrawalsLoading } = useCredits();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("mobile_money");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [notes, setNotes] = useState("");

  const creditsAmount = Number(amount) || 0;
  const mwkAmount = creditsAmount * CONVERSION_RATE;
  
  // Enhanced validation
  const isAmountValid = creditsAmount >= MIN_WITHDRAWAL && creditsAmount <= MAX_WITHDRAWAL && creditsAmount <= balance;
  const isPhoneValid = phoneNumber && /^\+?265\d{9}$/.test(phoneNumber.replace(/\s/g, ''));
  const canSubmit = isAmountValid && paymentMethod === "mobile_money" && isPhoneValid;

  const handleSubmit = () => {
    const paymentDetails = paymentMethod === "bank_transfer" 
      ? { account_number: accountNumber, bank_name: bankName, account_name: accountName }
      : { mobile: phoneNumber }; // ✅ Changed from phone_number to mobile

    requestWithdrawal.mutate({
      credits_amount: creditsAmount,
      payment_method: paymentMethod,
      payment_details: paymentDetails,
      notes: notes || undefined,
    });

    // Reset form
    setAmount("");
    setAccountNumber("");
    setBankName("");
    setAccountName("");
    setPhoneNumber("");
    setNotes("");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-orange-600" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case "rejected":
      case "cancelled":
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      pending: "secondary",
      processing: "outline",
      rejected: "destructive",
      cancelled: "destructive",
      failed: "destructive",
    };
    return variants[status] || "outline";
  };

  return (
    <DashboardLayout navItems={coachNavItems} sidebarSections={coachSidebarSections}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Withdrawals</h1>
          <p className="text-muted-foreground mt-2">
            Withdraw your earnings instantly to mobile money
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <CreditWallet showActions={false} />
            
            <div className="mt-4 space-y-2">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Conversion Rate:</strong> 1 Credit = MWK {CONVERSION_RATE}
                </AlertDescription>
              </Alert>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs space-y-1">
                  <div><strong>Withdrawal Limits:</strong></div>
                  <div>• Min: {MIN_WITHDRAWAL} credits (MWK {MIN_WITHDRAWAL * CONVERSION_RATE})</div>
                  <div>• Max per transaction: {MAX_WITHDRAWAL.toLocaleString()} credits</div>
                  <div>• Max per day: {DAILY_LIMIT.toLocaleString()} credits</div>
                  <div>• Rate limit: 5 requests per hour</div>
                </AlertDescription>
              </Alert>
              
              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-xs text-blue-900">
                  <strong>Credit Aging:</strong> Credits must be at least {CREDIT_AGING_DAYS} days old before withdrawal (prevents fraud).
                </AlertDescription>
              </Alert>
            </div>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownToLine className="h-5 w-5" />
                  Request Withdrawal
                </CardTitle>
                <CardDescription>
                  Instantly withdraw your earnings to mobile money
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (Credits)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    max={balance}
                    min={0}
                  />
                  {creditsAmount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      ≈ <span className="font-semibold">MWK {mwkAmount.toLocaleString()}</span>
                    </p>
                  )}
                  {creditsAmount > 0 && creditsAmount < MIN_WITHDRAWAL && (
                    <p className="text-sm text-destructive">
                      Minimum withdrawal: {MIN_WITHDRAWAL} credits (MWK {MIN_WITHDRAWAL * CONVERSION_RATE})
                    </p>
                  )}
                  {creditsAmount > MAX_WITHDRAWAL && (
                    <p className="text-sm text-destructive">
                      Maximum per transaction: {MAX_WITHDRAWAL.toLocaleString()} credits
                    </p>
                  )}
                  {creditsAmount > balance && (
                    <p className="text-sm text-destructive">
                      Insufficient balance. Available: {balance.toFixed(2)} credits
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-method">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="payment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile_money">Mobile Money (Instant)</SelectItem>
                      <SelectItem value="bank_transfer" disabled>Bank Transfer (Coming Soon)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentMethod === "bank_transfer" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="bank-name">Bank Name</Label>
                      <Input
                        id="bank-name"
                        placeholder="e.g., Standard Bank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account-name">Account Name</Label>
                      <Input
                        id="account-name"
                        placeholder="Full name on account"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account-number">Account Number</Label>
                      <Input
                        id="account-number"
                        placeholder="Enter account number"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="phone-number">Mobile Money Number</Label>
                    <Input
                      id="phone-number"
                      placeholder="e.g., +265 999 123 456"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Supported: Airtel (99/88), TNM (77/76)
                    </p>
                    {phoneNumber && !isPhoneValid && (
                      <p className="text-xs text-destructive">
                        Invalid format. Use: +265 999 123 456
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional information..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!canSubmit || requestWithdrawal.isPending}
                >
                  {requestWithdrawal.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="h-4 w-4 mr-2" />
                      Withdraw Now
                    </>
                  )}
                </Button>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground text-center">
                    ⚡ Instant payouts to mobile money (seconds to minutes)
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    🔒 Failed payouts are automatically refunded
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    🛡️ Protected by fraud detection and rate limiting
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Withdrawal History */}
        <Card>
          <CardHeader>
            <CardTitle>Withdrawal History</CardTitle>
            <CardDescription>
              Track the status of your withdrawal requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {withdrawalsLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : withdrawalRequests && withdrawalRequests.length > 0 ? (
              <div className="space-y-4">
                {withdrawalRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {getStatusIcon(request.status)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">
                            {request.credits_amount} Credits
                          </p>
                          <span className="text-muted-foreground">→</span>
                          <p className="text-muted-foreground">
                            MWK {request.amount.toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="capitalize">{request.payment_method.replace("_", " ")}</span>
                          <span>•</span>
                          <span>{new Date(request.created_at).toLocaleDateString()}</span>
                        </div>
                        {request.rejection_reason && (
                          <p className="text-sm text-destructive">
                            Reason: {request.rejection_reason}
                          </p>
                        )}
                        {request.status === "failed" && (
                          <p className="text-sm text-orange-600">
                            Credits have been automatically refunded to your wallet
                          </p>
                        )}
                        {request.notes && (
                          <p className="text-sm text-muted-foreground">
                            Note: {request.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={getStatusBadge(request.status)} className="capitalize">
                      {request.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No withdrawal requests yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
