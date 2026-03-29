export type FinancialTrendPoint = {
  month: string;
  earnings: number;
};

type TransactionRecord = {
  transaction_type: string;
  created_at: string;
  amount: number;
};

export function buildFinancialTrend(
  transactions: TransactionRecord[],
): FinancialTrendPoint[] {
  const earningsByMonth = new Map<string, number>();
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    return date.toISOString().slice(0, 7);
  });

  last6Months.forEach((month) => earningsByMonth.set(month, 0));

  transactions.forEach((transaction) => {
    if (transaction.transaction_type === "course_enrollment") {
      const month = new Date(transaction.created_at).toISOString().slice(0, 7);
      if (earningsByMonth.has(month)) {
        earningsByMonth.set(
          month,
          (earningsByMonth.get(month) || 0) + transaction.amount,
        );
      }
    }
  });

  return Array.from(earningsByMonth.entries()).map(([month, earnings]) => ({
    month: new Date(`${month}-01`).toLocaleDateString("en-US", {
      month: "short",
    }),
    earnings,
  }));
}
