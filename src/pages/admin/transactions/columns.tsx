import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

interface TransactionProfile {
  email: string | null;
}

export interface AdminTransaction {
  id: string;
  created_at: string;
  transaction_ref: string | null;
  order_id: string | null;
  transaction_mode: string | null;
  amount: number | string;
  status: string;
  profiles: TransactionProfile | null;
}

export interface TransactionColumn {
  key: string;
  header: string;
  render: (transaction: AdminTransaction) => ReactNode;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-MW", {
    style: "currency",
    currency: "MWK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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

export const transactionColumns: TransactionColumn[] = [
  {
    key: "date",
    header: "Date",
    render: (transaction) => new Date(transaction.created_at).toLocaleDateString(),
  },
  {
    key: "transaction_ref",
    header: "Transaction Ref",
    render: (transaction) => (
      <span className="font-mono">{transaction.transaction_ref || "N/A"}</span>
    ),
  },
  {
    key: "user",
    header: "User",
    render: (transaction) => transaction.profiles?.email || "N/A",
  },
  {
    key: "type",
    header: "Type",
    render: (transaction) => transaction.transaction_mode || "N/A",
  },
  {
    key: "amount",
    header: "Amount",
    render: (transaction) => (
      <span className="font-semibold">{formatCurrency(Number(transaction.amount))}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (transaction) => getStatusBadge(transaction.status),
  },
];
