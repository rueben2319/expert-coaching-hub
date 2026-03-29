import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AdminWithdrawalRequest } from "@/hooks/useAdminWithdrawals";

interface WithdrawalModerationDialogProps {
  open: boolean;
  action: "approve" | "reject" | null;
  withdrawal: AdminWithdrawalRequest | null;
  adminNotes: string;
  onAdminNotesChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isProcessing: boolean;
}

const formatMWK = (amount: number): string => {
  return new Intl.NumberFormat("en-MW", {
    style: "currency",
    currency: "MWK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export function WithdrawalModerationDialog({
  open,
  action,
  withdrawal,
  adminNotes,
  onAdminNotesChange,
  onOpenChange,
  onConfirm,
  isProcessing,
}: WithdrawalModerationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action === "approve" ? "Approve Withdrawal" : "Reject Withdrawal"}</DialogTitle>
          <DialogDescription>
            {action === "approve"
              ? "This will process the withdrawal and deduct credits from the coach's wallet."
              : "This will reject the withdrawal request. The coach will be notified."}
          </DialogDescription>
        </DialogHeader>

        {withdrawal && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg bg-muted p-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Coach:</span>
                <span className="text-sm">{withdrawal.coach?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Amount:</span>
                <span className="text-sm font-semibold">
                  {withdrawal.credits_amount} credits → {formatMWK(withdrawal.amount_mwk)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Phone:</span>
                <span className="text-sm">{withdrawal.phone_number}</span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Admin Notes (Optional)</label>
              <Textarea
                placeholder="Add any notes about this withdrawal..."
                value={adminNotes}
                onChange={(event) => onAdminNotesChange(event.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isProcessing || !action} variant={action === "approve" ? "default" : "destructive"}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Confirm ${action === "approve" ? "Approval" : "Rejection"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
