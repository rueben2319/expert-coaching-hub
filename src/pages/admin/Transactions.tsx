import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { adminSidebarSections } from "@/config/navigation";
import { Download, Search, Filter } from "lucide-react";
import { toast } from "sonner";

export default function AdminTransactions() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["admin-transactions", page, search, statusFilter, typeFilter],
    queryFn: async () => {
      const offset = page * pageSize;
      let query = supabase
        .from("transactions")
        .select(`
          *,
          profiles:user_id (full_name, email)
        `, { count: 'exact' })
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (typeFilter !== "all") {
        query = query.eq("transaction_mode", typeFilter);
      }

      if (search.trim()) {
        const trimmedSearch = search.trim();
        
        // Limit search length to prevent DoS attacks
        if (trimmedSearch.length > 100) {
          throw new Error("Search query too long (max 100 characters)");
        }
        
        // Sanitize special LIKE characters (% and _) to prevent injection
        // Escape backslashes first, then escape % and _
        const sanitizedSearch = trimmedSearch
          .replace(/\\/g, '\\\\')  // Escape backslashes first
          .replace(/%/g, '\\%')     // Escape %
          .replace(/_/g, '\\_');    // Escape _
        
        const searchPattern = `%${sanitizedSearch}%`;
        query = query.or(`transaction_ref.ilike.${searchPattern},order_id.ilike.${searchPattern}`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return { data: data || [], total: count || 0 };
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-MW', {
      style: 'currency',
      currency: 'MWK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      success: "default",
      pending: "secondary",
      failed: "destructive",
      cancelled: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const exportToCSV = () => {
    if (!transactions?.data) return;
    
    const headers = ["Date", "Transaction Ref", "User", "Type", "Amount", "Status"];
    const rows = transactions.data.map((t: any) => [
      new Date(t.created_at).toLocaleDateString(),
      t.transaction_ref,
      t.profiles?.email || "N/A",
      t.transaction_mode,
      t.amount,
      t.status,
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString()}.csv`;
    a.click();
    toast.success("Transactions exported to CSV");
  };

  return (
    <DashboardLayout sidebarSections={adminSidebarSections} brandName="Admin Panel">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Transaction Management
        </h1>
        <p className="text-muted-foreground">Monitor all platform transactions</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ref or order ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="coach_subscription">Coach Subscription</SelectItem>
                <SelectItem value="credit_purchase">Credit Purchase</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            Showing {transactions?.data?.length || 0} of {transactions?.total || 0} transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="text-left text-sm text-muted-foreground border-b">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Transaction Ref</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-6 px-4 text-center">Loading...</td>
                  </tr>
                ) : transactions && transactions.data.length > 0 ? (
                  transactions.data.map((txn: any) => (
                    <tr key={txn.id} className="hover:bg-muted/50 border-b">
                      <td className="py-3 px-4 text-sm">
                        {new Date(txn.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono">{txn.transaction_ref}</td>
                      <td className="py-3 px-4 text-sm">{txn.profiles?.email || "N/A"}</td>
                      <td className="py-3 px-4 text-sm">{txn.transaction_mode}</td>
                      <td className="py-3 px-4 text-sm font-semibold">
                        {formatCurrency(Number(txn.amount))}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(txn.status)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 px-4 text-center text-muted-foreground">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page + 1}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={!transactions || transactions.data.length < pageSize}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
