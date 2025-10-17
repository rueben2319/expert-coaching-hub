import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePayments } from "@/hooks/usePayments";
import { isBuilderPreview } from "@/lib/builderPreview";
import { clientNavItems, clientSidebarSections } from "@/config/navigation";
import { ChevronLeft, ChevronRight, CreditCard, Coins } from "lucide-react";

const MOCK_HISTORY = {
  invoices: [
    { id: "inv_1", invoice_number: "INV-2001", amount: 25, currency: "USD", status: "paid", invoice_date: new Date().toISOString(), description: "Course: React Basics" },
  ],
  transactions: [
    { id: "tx_1", transaction_ref: "txref_1", amount: 25, currency: "USD", status: "success", created_at: new Date().toISOString(), subscription_id: null },
  ],
};

const ClientBilling = () => {
  const { getPurchaseHistory } = usePayments();

  // Pagination state
  const [invoicePage, setInvoicePage] = useState(1);
  const itemsPerPage = 5;

  const builder = isBuilderPreview();

  const { data: history } = useQuery({
    queryKey: ["purchase_history"],
    queryFn: getPurchaseHistory,
    enabled: !builder,
    initialData: builder ? MOCK_HISTORY : undefined,
  });

  // Pagination helpers
  const getPaginatedItems = (items: any[], page: number) => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items?.slice(startIndex, endIndex) || [];
  };

  const getTotalPages = (items: any[]) => {
    return Math.ceil((items?.length || 0) / itemsPerPage);
  };

  const PaginationControls = ({ currentPage, totalPages, onPageChange }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  }) => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout navItems={clientNavItems} sidebarSections={clientSidebarSections}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Billing & Payments</h1>

        {/* Credit System Notice */}
        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Coins className="w-6 h-6 text-blue-600" />
              <div>
                <CardTitle className="text-blue-800">Credit-Based System</CardTitle>
                <CardDescription>Purchase credits to enroll in courses and access learning materials</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-blue-700">
                Our platform now uses a credit-based system for course access. Instead of direct payments, you can:
              </p>
              <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                <li>Purchase credit packages with real money</li>
                <li>Use credits to enroll in any course</li>
                <li>Track your credit balance and spending</li>
                <li>View detailed transaction history</li>
              </ul>
            </div>
            <div className="mt-4">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <CreditCard className="w-4 h-4 mr-2" />
                Go to Credits
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Your payment and invoice history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getPaginatedItems(history?.invoices, invoicePage).map((inv: any) => (
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
            <PaginationControls
              currentPage={invoicePage}
              totalPages={getTotalPages(history?.invoices)}
              onPageChange={setInvoicePage}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>All your payment transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getPaginatedItems(history?.transactions, invoicePage).map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium">{tx.transaction_ref}</div>
                      <div className="text-sm text-muted-foreground">
                        {tx.status === 'success' ? 'Completed' : 'Failed'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{tx.amount} {tx.currency}</div>
                      <div className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
                {(!history?.transactions || history.transactions.length === 0) && (
                  <div className="text-sm text-muted-foreground">No transactions yet.</div>
                )}
              </div>
            </CardContent>
            <PaginationControls
              currentPage={invoicePage}
              totalPages={getTotalPages(history?.transactions)}
              onPageChange={setInvoicePage}
            />
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ClientBilling;
