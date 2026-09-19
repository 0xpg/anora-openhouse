import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";

export function useContractAction() {
  const queryClient = useQueryClient();
  const { writeContractAsync, data: hash, error: writeError, isPending: isWritePending, reset } = useWriteContract();
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isConfirmed) {
      void queryClient.invalidateQueries();
    }
  }, [isConfirmed, queryClient]);

  return {
    writeContractAsync,
    hash,
    isPending: isWritePending,
    isConfirming,
    isConfirmed,
    error: writeError ?? receiptError,
    reset,
  };
}
