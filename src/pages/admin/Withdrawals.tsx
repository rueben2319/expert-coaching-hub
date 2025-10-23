import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CheckCircle, XCircle, Clock, AlertCircle, Users, BookOpen, Shield, Settings, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { callSupabaseFunction } from "@/lib/supabaseFunctions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function AdminWithdrawals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");

  const navItems = [
    { label: "Dashboard", href: "/admin" },
    { label: "Users", href: "/admin/users" },
    { label: "Withdrawals", href: "/admin/withdrawals" },
    { label: "Courses", href: "/admin/courses" },
    { label: "Settings", href: "/admin/settings" },
  ];

  const sidebarSections = [
    {
      title: "Management",
      items: [
        {
          icon: <Users className="h-4 w-4" />,
          label: "User Management",
          href: "/admin/users",
        },
        {
          icon: <BookOpen className="h-4 w-4" />,
          label: "Course Management",
          href: "/admin/courses",
        },
        {
          icon: <Shield className="h-4 w-4" />,
          label: "Roles & Permissions",
          href: "/admin/roles",
        },
      ],
    },
    {
      title: "Finance",
      items: [
        {
          icon: <AlertCircle className="h-4 w-4" />,
          label: "Withdrawal Requests",
          href: "/admin/withdrawals",
        },
      ],
    },
    {
      title: "System",
      items: [
        {
          icon: <BarChart3 className="h-4 w-4" />,
          label: "Analytics",
          href: "/admin/analytics",
        },
        {
          icon: <Settings className="h-4 w-4" />,
          label: "System Settings",
          href: "/admin/settings",
        },
      ],
    },
  ];

  const { data: withdrawalRequests, isLoading } = useQuery({
    queryKey: ["admin-withdrawal-requests"],
    queryFn: async () => {
      // First get withdrawal requests
      const { data: requests, error: requestsError } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (requestsError) {
        console.error("Error fetching withdrawal requests:", requestsError);
        throw requestsError;
      }

      if (!requests || requests.length === 0) {
        return [];
      }

      // Get coach profiles
      const coachIds = requests.map(r => r.coach_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", coachIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        // Continue without profiles if there's an error
      }

      // Combine the data
      const enrichedRequests = requests.map(request => ({
        ...request,
        profiles: profiles?.find(p => p.id === request.coach_id) || null
      }));

      return enrichedRequests;
    },
  });

  const processWithdrawalMutation = useMutation({
    mutationFn: async ({ requestId, action, notes }: { requestId: string; action: "approve" | "reject"; notes?: string }) => {
      return await callSupabaseFunction("approve-withdrawal", {
        withdrawal_request_id: requestId,
        action,
        admin_notes: notes,
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawal-requests"] });
      toast({
        title: `Withdrawal ${variables.action}d successfully`,
        description: `The withdrawal request has been ${variables.action}d.`,
      });
      setSelectedRequest(null);
      setAdminNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error processing withdrawal",
        description: error.message || "An error occurred while processing the withdrawal.",
        variant: "destructive",
      });
    },
  });

  const handleProcessWithdrawal = (request: any, action: "approve" | "reject") => {
    setSelectedRequest(request);
    setActionType(action);
    setAdminNotes("");
  };

  const confirmProcessWithdrawal = () => {
    if (!selectedRequest) return;

    processWithdrawalMutation.mutate({
      requestId: selectedRequest.id,
      action: actionType,
      notes: adminNotes.trim() || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatMWK = (amount: number) => {
    return new Intl.NumberFormat('en-MW', {
      style: 'currency',
      currency: 'MWK',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <DashboardLayout navItems={navItems} sidebarSections={sidebarSections}>
        <div className="text-center py-12">Loading withdrawal requests...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={navItems} sidebarSections={sidebarSections} brandName="Admin Panel">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Withdrawal Requests</h1>
            <p className="text-muted-foreground mt-2">
              Review and process coach withdrawal requests
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
                        {request.profiles?.full_name || "Unknown Coach"}
                      </CardTitle>
                      <CardDescription>{request.profiles?.email}</CardDescription>
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
                      <p className="text-lg font-semibold">{formatMWK(request.amount)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Payment Method</p>
                      <p className="text-sm capitalize">{request.payment_method}</p>
                    </div>
                  </div>

                  {request.payment_details && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Payment Details</p>
                      <div className="text-sm bg-muted p-2 rounded">
                        {typeof request.payment_details === 'object' ? (
                          <div className="space-y-1">
                            {Object.entries(request.payment_details).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="font-medium capitalize">{key.replace('_', ' ')}:</span>
                                <span>{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span>{String(request.payment_details)}</span>
                        )}
                      </div>
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

                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>Requested: {new Date(request.created_at).toLocaleString()}</span>
                    {request.processed_at && (
                      <span>Processed: {new Date(request.processed_at).toLocaleString()}</span>
                    )}
                  </div>

                  {request.status === "pending" && (
                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={() => handleProcessWithdrawal(request, "approve")}
                        className="bg-green-600 hover:bg-green-700"
                        disabled={processWithdrawalMutation.isPending}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleProcessWithdrawal(request, "reject")}
                        variant="destructive"
                        disabled={processWithdrawalMutation.isPending}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
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

        {/* Confirmation Dialog */}
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === "approve" ? "Approve" : "Reject"} Withdrawal Request
              </DialogTitle>
              <DialogDescription>
                {actionType === "approve"
                  ? "This will deduct credits from the coach's wallet and mark the withdrawal as approved."
                  : "This will reject the withdrawal request. The coach's credits will remain in their wallet."
                }
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="font-medium">{selectedRequest.profiles?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.credits_amount} Credits → {formatMWK(selectedRequest.amount)}</p>
                  <p className="text-sm text-muted-foreground capitalize">{selectedRequest.payment_method}: {typeof selectedRequest.payment_details === 'object' ? JSON.stringify(selectedRequest.payment_details) : selectedRequest.payment_details}</p>
                </div>

                <div>
                  <Label htmlFor="admin-notes">Admin Notes (Optional)</Label>
                  <Textarea
                    id="admin-notes"
                    placeholder="Add any notes about this decision..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmProcessWithdrawal}
                    disabled={processWithdrawalMutation.isPending}
                    variant={actionType === "approve" ? "default" : "destructive"}
                  >
                    {processWithdrawalMutation.isPending ? "Processing..." :
                     actionType === "approve" ? "Approve Withdrawal" : "Reject Withdrawal"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
