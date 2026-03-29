import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminSidebarSections } from "@/config/navigation";
import { Download, Search } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebounce";
import { exportTransactionsCsv } from "@/lib/admin/exportTransactionsCsv";
import { transactionColumns, type AdminTransaction } from "@/pages/admin/transactions/columns";

export default function AdminTransactions() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const debouncedSearch = useDebouncedValue(search, 400);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter, typeFilter]);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["admin-transactions", page, debouncedSearch, statusFilter, typeFilter],
    queryFn: async () => {
      const offset = page * pageSize;
      let query = supabase
        .from("transactions")
        .select(
          `
          *,
          profiles:user_id (full_name, email)
        `,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (typeFilter !== "all") {
        query = query.eq("transaction_mode", typeFilter);
      }

      if (debouncedSearch.trim()) {
        const trimmedSearch = debouncedSearch.trim();

        if (trimmedSearch.length > 100) {
          throw new Error("Search query too long (max 100 characters)");
        }

        const sanitizedSearch = trimmedSearch.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

        const searchPattern = `%${sanitizedSearch}%`;
        query = query.or(`transaction_ref.ilike.${searchPattern},order_id.ilike.${searchPattern}`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return { data: (data || []) as AdminTransaction[], total: count || 0 };
    },
  });

  return (
    <DashboardLayout sidebarSections={adminSidebarSections} brandName="Admin Panel">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Transaction Management
        </h1>
        <p className="text-muted-foreground">Monitor all platform transactions</p>
      </div>

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
            <Button onClick={() => exportTransactionsCsv(transactions?.data || [])} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            Showing {transactions?.data?.length || 0} of {transactions?.total || 0} transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {transactionColumns.map((column) => (
                    <TableHead key={column.key}>{column.header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={transactionColumns.length} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : transactions && transactions.data.length > 0 ? (
                  transactions.data.map((transaction) => (
                    <TableRow key={transaction.id}>
                      {transactionColumns.map((column) => (
                        <TableCell key={column.key}>{column.render(transaction)}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={transactionColumns.length} className="text-center py-8 text-muted-foreground">
                      No transactions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-4 md:hidden">
            {isLoading ? (
              <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : transactions && transactions.data.length > 0 ? (
              transactions.data.map((transaction) => (
                <div key={transaction.id} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  {transactionColumns.map((column) => (
                    <div key={column.key} className="flex items-start justify-between gap-3">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">{column.header}</span>
                      <div className="text-sm text-right">{column.render(transaction)}</div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">No transactions found</div>
            )}
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
