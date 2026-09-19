import { useReadContract, useReadContracts } from "wagmi";
import { anoraPoolContract, testUsdcContract } from "../config/contracts";

const REFETCH_MS = 5_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export interface PoolBoard {
  seniorAssets: bigint;
  juniorAssets: bigint;
  firstLossReserve: bigint;
  liquidity: bigint;
  seniorCapacity: bigint;
  poolUsdcBalance: bigint;
}

export function usePoolBoard() {
  const { data, isLoading, error } = useReadContracts({
    contracts: [
      { ...anoraPoolContract, functionName: "seniorAssets" },
      { ...anoraPoolContract, functionName: "juniorAssets" },
      { ...anoraPoolContract, functionName: "firstLossReserve" },
      { ...anoraPoolContract, functionName: "liquidity" },
      { ...anoraPoolContract, functionName: "seniorCapacity" },
      { ...testUsdcContract, functionName: "balanceOf", args: [anoraPoolContract.address] },
    ],
    query: { refetchInterval: REFETCH_MS },
  });

  const board: PoolBoard | undefined = data
    ? {
        seniorAssets: (data[0].result as bigint) ?? 0n,
        juniorAssets: (data[1].result as bigint) ?? 0n,
        firstLossReserve: (data[2].result as bigint) ?? 0n,
        liquidity: (data[3].result as bigint) ?? 0n,
        seniorCapacity: (data[4].result as bigint) ?? 0n,
        poolUsdcBalance: (data[5].result as bigint) ?? 0n,
      }
    : undefined;

  return { board, isLoading, error };
}

export function usePolicy() {
  return useReadContract({
    ...anoraPoolContract,
    functionName: "policy",
    query: { refetchInterval: false, staleTime: Infinity },
  });
}

export function useRiskAgent() {
  return useReadContract({
    ...anoraPoolContract,
    functionName: "riskAgent",
    query: { refetchInterval: REFETCH_MS },
  });
}

export function useIsRiskAgent(address: `0x${string}` | undefined) {
  const { data: riskAgent } = useRiskAgent();
  if (!address || !riskAgent) return false;
  return address.toLowerCase() === riskAgent.toLowerCase();
}

export function useNextFacilityId() {
  return useReadContract({
    ...anoraPoolContract,
    functionName: "nextFacilityId",
    query: { refetchInterval: REFETCH_MS },
  });
}

export function useMyShares(address: `0x${string}` | undefined) {
  const { data } = useReadContracts({
    contracts: [
      { ...anoraPoolContract, functionName: "seniorShares", args: [address ?? ZERO_ADDRESS] },
      { ...anoraPoolContract, functionName: "juniorShares", args: [address ?? ZERO_ADDRESS] },
      { ...anoraPoolContract, functionName: "seniorTotalShares" },
      { ...anoraPoolContract, functionName: "juniorTotalShares" },
    ],
    query: { enabled: !!address, refetchInterval: REFETCH_MS },
  });

  return {
    seniorShares: (data?.[0]?.result as bigint) ?? 0n,
    juniorShares: (data?.[1]?.result as bigint) ?? 0n,
    seniorTotalShares: (data?.[2]?.result as bigint) ?? 0n,
    juniorTotalShares: (data?.[3]?.result as bigint) ?? 0n,
  };
}

export function useUsdcBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    ...testUsdcContract,
    functionName: "balanceOf",
    args: [address ?? ZERO_ADDRESS],
    query: { enabled: !!address, refetchInterval: REFETCH_MS },
  });
}

export function useUsdcAllowance(owner: `0x${string}` | undefined) {
  return useReadContract({
    ...testUsdcContract,
    functionName: "allowance",
    args: [owner ?? ZERO_ADDRESS, anoraPoolContract.address],
    query: { enabled: !!owner, refetchInterval: REFETCH_MS },
  });
}
