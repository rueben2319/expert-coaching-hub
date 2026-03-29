import { toast } from "sonner";
import type { AdminTransaction } from "@/pages/admin/transactions/columns";

export function exportTransactionsCsv(transactions: AdminTransaction[]) {
  if (!transactions.length) {
    return;
  }

  const headers = ["Date", "Transaction Ref", "User", "Type", "Amount", "Status"];
  const rows = transactions.map((transaction) => [
    new Date(transaction.created_at).toLocaleDateString(),
    transaction.transaction_ref || "N/A",
    transaction.profiles?.email || "N/A",
    transaction.transaction_mode || "N/A",
    String(transaction.amount),
    transaction.status,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `transactions-${new Date().toISOString()}.csv`;
  anchor.click();
  window.URL.revokeObjectURL(url);

  toast.success("Transactions exported to CSV");
}
