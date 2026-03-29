import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CheckCircle, XCircle, Clock, AlertCircle, Loader2, AlertTriangle, Filter } from "lucide-react";
import { adminSidebarSections } from "@/config/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WithdrawalModerationDialog } from "@/components/admin/WithdrawalModerationDialog";
import { AdminWithdrawalRequest, useAdminWithdrawals } from "@/hooks/useAdminWithdrawals";

export default function AdminWithdrawals() {
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<AdminWithdrawalRequest | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { withdrawalRequests, isLoading, processWithdrawal, isProcessingAction } = useAdminWithdrawals();

  const handleProcessWithdrawal = (withdrawal: AdminWithdrawalRequest, actionType: "approve" | "reject") => {
    setSelectedWithdrawal(withdrawal);
    setAction(actionType);
  };

  const closeModerationDialog = () => {
    setSelectedWithdrawal(null);
    setAction(null);
    setAdminNotes("");
  };

  const confirmProcessWithdrawal = async () => {
    if (!selectedWithdrawal || !action) return;

    try {
      const wasSubmitted = await processWithdrawal({
        withdrawal_id: selectedWithdrawal.id,
        action,
        admin_notes: adminNotes,
      });

      if (wasSubmitted) {
        closeModerationDialog();
      }
    } catch {
      // Error toast is handled by the hook mutation callbacks.
    }
  };

  const formatMWK = (amount: number): string => {
    return new Intl.NumberFormat('en-MW', { 
      style: 'currency', 
      currency: 'MWK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "processing":
        return <Badge variant="outline" className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Processing</Badge>;
      case "approved":
      case "completed":
        return <Badge variant="default" className="bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {status === "completed" ? "Completed" : "Approved"}</Badge>;
      case "rejected":
      case "failed":
      case "cancelled":
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> {status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout sidebarSections={adminSidebarSections} brandName="Admin Panel">
        <div className="text-center py-12">Loading withdrawal requests...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout sidebarSections={adminSidebarSections} brandName="Admin Panel">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Withdrawal Requests</h1>
            <p className="text-muted-foreground mt-2">
              Monitor and process coach withdrawal requests
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Critical Alerts for Failed Withdrawals */}
        {withdrawalRequests && withdrawalRequests.filter((r) => r.status === "failed" && r.rejection_reason?.includes("Reference:")).length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Critical:</strong> {withdrawalRequests.filter((r) => r.status === "failed" && r.rejection_reason?.includes("Reference:")).length} withdrawal(s) require manual intervention. Check failed withdrawals below.
            </AlertDescription>
          </Alert>
        )}

        {withdrawalRequests && withdrawalRequests.length > 0 ? (
          <div className="grid gap-4">
            {withdrawalRequests
              .filter((request) => statusFilter === "all" || request.status === statusFilter)
              .map((request) => (
              <Card key={request.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        {request.coach?.full_name || "Unknown Coach"}
                      </CardTitle>
                      <CardDescription>{request.coach?.email}</CardDescription>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Credits Amount</p>
                      <p className="text-lg font-semibold">{request.credits_amount} Credits</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">MWK Amount</p>
                      <p className="text-lg font-semibold">{formatMWK(request.amount_mwk)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Payment Method</p>
                      <p className="text-sm capitalize">{request.payment_method}</p>
                    </div>
                  </div>

                  {request.phone_number && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Phone Number</p>
                      <p className="text-sm bg-muted p-2 rounded">{request.phone_number}</p>
                    </div>
                  )}

                  {request.notes && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Coach Notes</p>
                      <p className="text-sm bg-muted p-2 rounded">{request.notes}</p>
                    </div>
                  )}

                  {request.admin_notes && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Admin Notes</p>
                      <p className="text-sm bg-blue-50 text-blue-700 p-2 rounded border-l-4 border-blue-400">
                        {request.admin_notes}
                      </p>
                    </div>
                  )}

                  {request.rejection_reason && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Failure Reason</p>
                      <p className={`text-sm p-2 rounded border-l-4 ${
                        request.rejection_reason.includes("Reference:") 
                          ? "bg-red-50 text-red-700 border-red-400" 
                          : "bg-orange-50 text-orange-700 border-orange-400"
                      }`}>
                        {request.rejection_reason}
                      </p>
                    </div>
                  )}

                  {request.fraud_score && request.fraud_score > 50 && (
                    <Alert className="mb-4">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Fraud Score:</strong> {request.fraud_score}/100
                        {request.fraud_reasons && request.fraud_reasons.length > 0 && (
                          <ul className="mt-1 text-xs list-disc list-inside">
                            {request.fraud_reasons.map((reason: string, idx: number) => (
                              <li key={idx}>{reason}</li>
                            ))}
                          </ul>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-between items-center text-sm text-muted-foreground mb-4">
                    <span>Requested: {new Date(request.created_at).toLocaleString()}</span>
                    {request.processed_at && (
                      <span>Processed: {new Date(request.processed_at).toLocaleString()}</span>
                    )}
                  </div>

                  {/* Action Buttons for Pending Withdrawals */}
                  {request.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleProcessWithdrawal(request, "approve")}
                        className="flex-1"
                        variant="default"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleProcessWithdrawal(request, "reject")}
                        className="flex-1"
                        variant="destructive"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {/* Action Buttons for Failed Withdrawals */}
                  {request.status === "failed" && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleProcessWithdrawal(request, "approve")}
                        className="flex-1"
                        variant="outline"
                        title="Manually approve and retry this failed withdrawal"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Retry Payout
                      </Button>
                      <Button
                        onClick={() => handleProcessWithdrawal(request, "reject")}
                        className="flex-1"
                        variant="outline"
                        title="Mark as rejected and close the case"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Close Case
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No withdrawal requests</h3>
              <p className="text-muted-foreground">
                There are currently no withdrawal requests to review.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <WithdrawalModerationDialog
        open={!!selectedWithdrawal}
        action={action}
        withdrawal={selectedWithdrawal}
        adminNotes={adminNotes}
        onAdminNotesChange={setAdminNotes}
        onOpenChange={(open) => {
          if (!open) closeModerationDialog();
        }}
        onConfirm={confirmProcessWithdrawal}
        isProcessing={isProcessingAction}
      />

    </DashboardLayout>
  );
}
