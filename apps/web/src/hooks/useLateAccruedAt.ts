import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { anoraPoolContract } from "../config/contracts";

const LOOKBACK_BLOCKS = 20_000n;

export function useLateAccruedAt(id: number, enabled: boolean) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["lateAccruedAt", id],
    enabled: enabled && !!publicClient,
    refetchInterval: 5_000,
    queryFn: async () => {
      if (!publicClient) return undefined;
      const latest = await publicClient.getBlockNumber();
      const fromBlock = latest > LOOKBACK_BLOCKS ? latest - LOOKBACK_BLOCKS : 0n;
      const logs = await publicClient.getContractEvents({
        address: anoraPoolContract.address,
        abi: anoraPoolContract.abi,
        eventName: "MarkedLate",
        args: { id: BigInt(id) },
        fromBlock,
        toBlock: latest,
      });
      if (logs.length === 0) return undefined;
      const last = logs[logs.length - 1];
      return (last.args as { at?: bigint }).at;
    },
  });
}
