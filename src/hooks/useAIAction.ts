import { useMutation } from "@tanstack/react-query";
import { invokeAIAction, AIRequestPayload, AIResponsePayload, AIRequestError } from "@/lib/ai/aiClient";

interface UseAIActionOptions {
  onSuccess?: (data: AIResponsePayload) => void;
  onError?: (error: AIRequestError) => void;
}

export function useAIAction(options: UseAIActionOptions = {}) {
  const mutation = useMutation<AIResponsePayload, AIRequestError, AIRequestPayload>({
    mutationFn: async (payload) => {
      return invokeAIAction(payload);
    },
    onSuccess: (data) => {
      options.onSuccess?.(data);
    },
    onError: (error) => {
      options.onError?.(error);
    },
  });

  return {
    generate: mutation.mutate,
    generateAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    data: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}
