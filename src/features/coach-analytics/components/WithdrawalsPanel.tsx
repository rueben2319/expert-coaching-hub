import { Banknote } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Withdrawal = {
  id: string;
  created_at: string;
  credits_amount: number;
  amount: number;
  status: string;
};

type WithdrawalsPanelProps = {
  withdrawalRequests?: Withdrawal[];
};

export function WithdrawalsPanel({
  withdrawalRequests,
}: WithdrawalsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote className="h-5 w-5" />
          Recent Withdrawals
        </CardTitle>
        <CardDescription>Your recent withdrawal requests</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount (CR)</TableHead>
              <TableHead>Amount (MWK)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {withdrawalRequests?.slice(0, 5).map((withdrawal) => (
              <TableRow key={withdrawal.id}>
                <TableCell>
                  {new Date(withdrawal.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {withdrawal.credits_amount.toLocaleString()}
                </TableCell>
                <TableCell>{withdrawal.amount.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      withdrawal.status === "completed"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {withdrawal.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
