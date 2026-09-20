import { useChainId, useReadContract, useReadContracts } from "wagmi";
import { assetContract, poolContract } from "../config/contracts";
import { useAssetAddress, usePoolAddress } from "./useDeployment";

const REFETCH_MS = 5_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export interface PoolBoard {
  seniorAssets: bigint;
  juniorAssets: bigint;
  firstLossReserve: bigint;
  liquidity: bigint;
  seniorCapacity: bigint;
  poolAssetBalance: bigint;
}

export function usePoolBoard() {
  const chainId = useChainId();
  const poolAddress = usePoolAddress();
  const assetAddress = useAssetAddress();
  const enabled = !!poolAddress && !!assetAddress;
  const pool = poolContract(poolAddress ?? ZERO_ADDRESS);
  const asset = assetContract(assetAddress ?? ZERO_ADDRESS);

  const { data, isLoading, error } = useReadContracts({
    contracts: [
      { ...pool, chainId, functionName: "seniorAssets" },
      { ...pool, chainId, functionName: "juniorAssets" },
      { ...pool, chainId, functionName: "firstLossReserve" },
      { ...pool, chainId, functionName: "liquidity" },
      { ...pool, chainId, functionName: "seniorCapacity" },
      { ...asset, chainId, functionName: "balanceOf", args: [pool.address] },
    ],
    query: { enabled, refetchInterval: REFETCH_MS },
  });

  const board: PoolBoard | undefined = data
    ? {
        seniorAssets: (data[0].result as bigint) ?? 0n,
        juniorAssets: (data[1].result as bigint) ?? 0n,
        firstLossReserve: (data[2].result as bigint) ?? 0n,
        liquidity: (data[3].result as bigint) ?? 0n,
        seniorCapacity: (data[4].result as bigint) ?? 0n,
        poolAssetBalance: (data[5].result as bigint) ?? 0n,
      }
    : undefined;

  return { board, isLoading, error };
}

export function usePolicy() {
  const chainId = useChainId();
  const poolAddress = usePoolAddress();
  const pool = poolContract(poolAddress ?? ZERO_ADDRESS);

  return useReadContract({
    ...pool,
    functionName: "policy",
    chainId,
    query: { enabled: !!poolAddress, refetchInterval: false, staleTime: Infinity },
  });
}

export function useRiskAgent() {
  const chainId = useChainId();
  const poolAddress = usePoolAddress();
  const pool = poolContract(poolAddress ?? ZERO_ADDRESS);

  return useReadContract({
    ...pool,
    functionName: "riskAgent",
    chainId,
    query: { enabled: !!poolAddress, refetchInterval: REFETCH_MS },
  });
}

export function useIsRiskAgent(address: `0x${string}` | undefined) {
  const { data: riskAgent } = useRiskAgent();
  if (!address || !riskAgent) return false;
  return address.toLowerCase() === riskAgent.toLowerCase();
}

export function useNextFacilityId() {
  const chainId = useChainId();
  const poolAddress = usePoolAddress();
  const pool = poolContract(poolAddress ?? ZERO_ADDRESS);

  return useReadContract({
    ...pool,
    functionName: "nextFacilityId",
    chainId,
    query: { enabled: !!poolAddress, refetchInterval: REFETCH_MS },
  });
}

export function useMyShares(address: `0x${string}` | undefined) {
  const chainId = useChainId();
  const poolAddress = usePoolAddress();
  const pool = poolContract(poolAddress ?? ZERO_ADDRESS);

  const { data } = useReadContracts({
    contracts: [
      { ...pool, chainId, functionName: "seniorShares", args: [address ?? ZERO_ADDRESS] },
      { ...pool, chainId, functionName: "juniorShares", args: [address ?? ZERO_ADDRESS] },
      { ...pool, chainId, functionName: "seniorTotalShares" },
      { ...pool, chainId, functionName: "juniorTotalShares" },
    ],
    query: { enabled: !!poolAddress && !!address, refetchInterval: REFETCH_MS },
  });

  return {
    seniorShares: (data?.[0]?.result as bigint) ?? 0n,
    juniorShares: (data?.[1]?.result as bigint) ?? 0n,
    seniorTotalShares: (data?.[2]?.result as bigint) ?? 0n,
    juniorTotalShares: (data?.[3]?.result as bigint) ?? 0n,
  };
}

export function useAssetBalance(address: `0x${string}` | undefined) {
  const chainId = useChainId();
  const assetAddress = useAssetAddress();
  const asset = assetContract(assetAddress ?? ZERO_ADDRESS);

  return useReadContract({
    ...asset,
    functionName: "balanceOf",
    args: [address ?? ZERO_ADDRESS],
    chainId,
    query: { enabled: !!assetAddress && !!address, refetchInterval: REFETCH_MS },
  });
}

export function useAssetAllowance(owner: `0x${string}` | undefined) {
  const chainId = useChainId();
  const poolAddress = usePoolAddress();
  const assetAddress = useAssetAddress();
  const asset = assetContract(assetAddress ?? ZERO_ADDRESS);

  return useReadContract({
    ...asset,
    functionName: "allowance",
    args: [owner ?? ZERO_ADDRESS, poolAddress ?? ZERO_ADDRESS],
    chainId,
    query: { enabled: !!assetAddress && !!poolAddress && !!owner, refetchInterval: REFETCH_MS },
  });
}
