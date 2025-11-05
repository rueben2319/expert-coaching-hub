import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callSupabaseFunction } from "@/lib/supabaseFunctions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { adminSidebarSections } from "@/config/navigation";
import { toast } from "sonner";

export default function AdminWithdrawals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: withdrawalRequests, isLoading } = useQuery({
    queryKey: ["admin-withdrawal-requests"],
    queryFn: async () => {
      const { data: requests, error: requestsError } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (requestsError) throw requestsError;

      if (!requests || requests.length === 0) return [];

      const coachIds = requests.map((r: any) => r.coach_id);
      const { data: coaches, error: coachesError} = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", coachIds);

      if (coachesError) throw coachesError;

      const coachMap: Record<string, any> = {};
      (coaches || []).forEach((coach: any) => {
        coachMap[coach.id] = coach;
      });

      const enriched = requests.map((request: any) => ({
        ...request,
        coach: coachMap[request.coach_id] || null,
      }));

      return enriched;
    },
  });

  const processWithdrawalMutation = useMutation({
    mutationFn: async ({ withdrawal_id, action, admin_notes }: { withdrawal_id: string; action: string; admin_notes: string }) => {
      return await callSupabaseFunction("process-withdrawal", {
        withdrawal_id,
        action,
        admin_notes,
      });
    },
    onSuccess: () => {
      toast.success(`Withdrawal ${action === "approve" ? "approved" : "rejected"} successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawal-requests"] });
      setSelectedWithdrawal(null);
      setAction(null);
      setAdminNotes("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to process withdrawal");
    },
  });

  const handleProcessWithdrawal = (withdrawal: any, actionType: "approve" | "reject") => {
    setSelectedWithdrawal(withdrawal);
    setAction(actionType);
  };

  const confirmProcessWithdrawal = () => {
    if (!selectedWithdrawal || !action) return;
    processWithdrawalMutation.mutate({
      withdrawal_id: selectedWithdrawal.id,
      action,
      admin_notes: adminNotes,
    });
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
        </div>

        {withdrawalRequests && withdrawalRequests.length > 0 ? (
          <div className="grid gap-4">
            {withdrawalRequests.map((request: any) => (
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

      {/* Process Withdrawal Dialog */}
      <Dialog open={!!selectedWithdrawal} onOpenChange={() => { setSelectedWithdrawal(null); setAction(null); setAdminNotes(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "Approve Withdrawal" : "Reject Withdrawal"}
            </DialogTitle>
            <DialogDescription>
              {action === "approve" 
                ? "This will process the withdrawal and deduct credits from the coach's wallet."
                : "This will reject the withdrawal request. The coach will be notified."}
            </DialogDescription>
          </DialogHeader>
          
          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Coach:</span>
                  <span className="text-sm">{selectedWithdrawal.coach?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Amount:</span>
                  <span className="text-sm font-semibold">
                    {selectedWithdrawal.credits_amount} credits → {formatMWK(selectedWithdrawal.amount_mwk)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Phone:</span>
                  <span className="text-sm">{selectedWithdrawal.phone_number}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Admin Notes (Optional)</label>
                <Textarea
                  placeholder="Add any notes about this withdrawal..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setSelectedWithdrawal(null); setAction(null); setAdminNotes(""); }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmProcessWithdrawal}
              disabled={processWithdrawalMutation.isPending}
              variant={action === "approve" ? "default" : "destructive"}
            >
              {processWithdrawalMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Confirm ${action === "approve" ? "Approval" : "Rejection"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
