import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { coachSidebarSections } from "@/config/navigation";
import { useCredits } from "@/hooks/useCredits";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, Wallet, Clock, CheckCircle, XCircle, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { CreditWallet } from "@/components/CreditWallet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WITHDRAWAL_LIMITS } from "@/lib/withdrawalLimits";
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const creditsAmount = Number(amount) || 0;
  const mwkAmount = creditsAmount * CONVERSION_RATE;
  
  // Enhanced validation
  const isAmountValid = creditsAmount >= MIN_WITHDRAWAL && creditsAmount <= MAX_WITHDRAWAL && creditsAmount <= balance;
    const isPhoneValid = phoneNumber && /^(0|\+?265)?(99|98|90|88|86|85|84|83)\d{7}$/.test(phoneNumber.replace(/\s/g, ''));
  const canSubmit = isAmountValid && paymentMethod === "mobile_money" && isPhoneValid;

  const handleSubmit = () => {
    const paymentDetails = paymentMethod === "bank_transfer" 
      ? { account_number: accountNumber, bank_name: bankName, account_name: accountName }
      : { mobile: phoneNumber.replace(/\s/g, '') }; // Normalize spaces

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
    setConfirmOpen(false);
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
    <DashboardLayout sidebarSections={coachSidebarSections}>
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
                <div className="grid md:grid-cols-2 gap-4">
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
                      aria-invalid={!isAmountValid && !!amount}
                      aria-describedby={!isAmountValid && !!amount ? "amount-error" : undefined}
                    />
                    {creditsAmount > 0 && (
                      <p className="text-sm text-muted-foreground">
                        ≈ <span className="font-semibold">MWK {mwkAmount.toLocaleString()}</span>
                      </p>
                    )}
                    {creditsAmount > 0 && creditsAmount < MIN_WITHDRAWAL && (
                      <p id="amount-error" className="text-sm text-destructive">
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
                </div>

                {paymentMethod === "bank_transfer" ? (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
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
                      aria-invalid={!!phoneNumber && !isPhoneValid}
                      aria-describedby={!!phoneNumber && !isPhoneValid ? "phone-error" : undefined}
                    />
                    <p className="text-xs text-muted-foreground">
                                            Supported: Airtel (099, 098, 090), TNM (088, 086, 085, 084, 083)
                    </p>
                    {phoneNumber && !isPhoneValid && (
                      <p id="phone-error" className="text-xs text-destructive">
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

                {/* Summary */}
                <div className="grid md:grid-cols-3 gap-3 text-sm border rounded-lg p-3 bg-card/50">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">You will receive</p>
                    <p className="font-semibold">MWK {mwkAmount.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Payment method</p>
                    <p className="font-semibold capitalize">{paymentMethod.replace("_", " ")}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Fee</p>
                    <p className="font-semibold">MWK 0</p>
                  </div>
                </div>

                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="w-full"
                      size="lg"
                      disabled={!canSubmit || requestWithdrawal.isPending}
                      aria-disabled={!canSubmit || requestWithdrawal.isPending}
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
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Withdrawal</AlertDialogTitle>
                      <AlertDialogDescription>
                        You are about to withdraw <strong>{creditsAmount}</strong> credits (≈ MWK {mwkAmount.toLocaleString()}) to <strong>{paymentMethod.replace("_", " ")}</strong>.
                        Please confirm the details are correct.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="rounded-lg border p-3 text-sm bg-muted/40">
                      <div className="flex items-center justify-between">
                        <span>Amount (Credits)</span>
                        <span className="font-semibold">{creditsAmount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Amount (MWK)</span>
                        <span className="font-semibold">{mwkAmount.toLocaleString()}</span>
                      </div>
                      {paymentMethod === "mobile_money" && (
                        <div className="flex items-center justify-between">
                          <span>Mobile</span>
                          <span className="font-semibold">{phoneNumber || "-"}</span>
                        </div>
                      )}
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSubmit} disabled={!canSubmit}>
                        Confirm & Withdraw
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="space-y-1" role="status" aria-live="polite">
                  <p className="text-xs text-muted-foreground text-center">
                    <ShieldCheck className="inline h-3.5 w-3.5 mr-1" /> Instant payouts; automatic refunds on failure
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
