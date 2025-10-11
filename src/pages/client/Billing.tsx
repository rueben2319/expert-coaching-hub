import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePayments } from "@/hooks/usePayments";
import { toast } from "sonner";
import { isBuilderPreview } from "@/lib/builderPreview";

const MOCK_HISTORY = {
  invoices: [
    { id: "inv_1", invoice_number: "INV-2001", amount: 25, currency: "USD", status: "paid", invoice_date: new Date().toISOString(), description: "Course: React Basics" },
  ],
  orders: [
    { id: "ord_1", client_id: "client_1", coach_id: "coach_1", type: "one_time", amount: 25, currency: "USD", status: "paid", transaction_id: "tx_1", course_id: "course_1", created_at: new Date().toISOString() },
  ],
  subscriptions: [],
  transactions: [
    { id: "tx_1", transaction_ref: "txref_1", amount: 25, currency: "USD", status: "success", created_at: new Date().toISOString(), order_id: "ord_1", subscription_id: null },
  ],
};

const ClientBilling = () => {
  const { getPurchaseHistory, createClientOneTimeOrder } = usePayments();
  const [coachId, setCoachId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [amount, setAmount] = useState("");

  const builder = isBuilderPreview();

  const { data: history } = useQuery({
    queryKey: ["purchase_history"],
    queryFn: getPurchaseHistory,
    enabled: !builder,
    initialData: builder ? MOCK_HISTORY : undefined,
  });

  const startOneTimePayment = async () => {
    try {
      const amt = Number(amount);
      if (!coachId || !courseId || !amt) {
        toast.error("Coach, course and amount are required");
        return;
      }
      if (builder) {
        toast.success("Builder preview: simulated payment successful");
        return;
      }
      const { checkout_url } = await createClientOneTimeOrder(coachId, courseId, amt);
      window.location.href = checkout_url;
    } catch (e: any) {
      toast.error(e.message || "Failed to start checkout");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Billing & Payments</h1>

        <Card>
          <CardHeader>
            <CardTitle>Quick one-time purchase</CardTitle>
            <CardDescription>Enter details to purchase a course.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input placeholder="Coach ID" value={coachId} onChange={(e) => setCoachId(e.target.value)} />
            <Input placeholder="Course ID" value={courseId} onChange={(e) => setCourseId(e.target.value)} />
            <Input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button onClick={startOneTimePayment}>Pay</Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {history?.invoices?.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium">{inv.invoice_number}</div>
                      <div className="text-sm text-muted-foreground">{inv.description || "Payment"}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{inv.amount} {inv.currency}</div>
                      <div className="text-xs text-muted-foreground">{new Date(inv.invoice_date).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
                {(!history?.invoices || history.invoices.length === 0) && (
                  <div className="text-sm text-muted-foreground">No invoices yet.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {history?.orders?.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium">{o.type} {o.course_id ? `• ${o.course_id}` : ""}</div>
                      <div className="text-sm text-muted-foreground">Coach: {o.coach_id}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{o.amount} {o.currency}</div>
                      <div className="text-xs text-muted-foreground">{o.status}</div>
                    </div>
                  </div>
                ))}
                {(!history?.orders || history.orders.length === 0) && (
                  <div className="text-sm text-muted-foreground">No orders yet.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ClientBilling;
