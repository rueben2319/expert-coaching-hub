import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callSupabaseFunction } from "@/lib/supabaseFunctions";
import { toast } from "sonner";

interface CoachProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface WithdrawalRequestRecord {
  id: string;
  coach_id: string;
  status: string;
  credits_amount: number;
  amount_mwk: number;
  payment_method: string | null;
  phone_number: string | null;
  notes: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  fraud_score: number | null;
  fraud_reasons: string[] | null;
  created_at: string;
  processed_at: string | null;
}

export type AdminWithdrawalRequest = WithdrawalRequestRecord & {
  coach: CoachProfile | null;
};

interface ProcessWithdrawalInput {
  withdrawal_id: string;
  action: "approve" | "reject";
  admin_notes: string;
}

export function useAdminWithdrawals() {
  const queryClient = useQueryClient();
  const [isMutationLocked, setIsMutationLocked] = useState(false);

  const requestsQuery = useQuery({
    queryKey: ["admin-withdrawal-requests"],
    queryFn: async (): Promise<AdminWithdrawalRequest[]> => {
      const { data: requests, error: requestsError } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (requestsError) throw requestsError;
      if (!requests?.length) return [];

      const coachIds = Array.from(new Set(requests.map((request) => request.coach_id)));
      const { data: coaches, error: coachesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", coachIds);

      if (coachesError) throw coachesError;

      const coachMap = new Map((coaches ?? []).map((coach) => [coach.id, coach]));

      return requests.map((request) => ({
        ...(request as WithdrawalRequestRecord),
        coach: coachMap.get(request.coach_id) ?? null,
      }));
    },
  });

  const processWithdrawalMutation = useMutation({
    mutationFn: async ({ withdrawal_id, action, admin_notes }: ProcessWithdrawalInput) => {
      return callSupabaseFunction("process-withdrawal", {
        withdrawal_id,
        action,
        admin_notes,
      });
    },
    onSuccess: (_, variables) => {
      toast.success(`Withdrawal ${variables.action === "approve" ? "approved" : "rejected"} successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawal-requests"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to process withdrawal");
    },
    onSettled: () => {
      setIsMutationLocked(false);
    },
  });

  const processWithdrawal = useCallback(
    async (input: ProcessWithdrawalInput) => {
      if (isMutationLocked || processWithdrawalMutation.isPending) {
        return false;
      }

      setIsMutationLocked(true);
      await processWithdrawalMutation.mutateAsync(input);
      return true;
    },
    [isMutationLocked, processWithdrawalMutation],
  );

  const isProcessingAction = useMemo(
    () => processWithdrawalMutation.isPending || isMutationLocked,
    [isMutationLocked, processWithdrawalMutation.isPending],
  );

  return {
    withdrawalRequests: requestsQuery.data ?? [],
    isLoading: requestsQuery.isLoading,
    isError: requestsQuery.isError,
    processWithdrawal,
    isProcessingAction,
  };
}
