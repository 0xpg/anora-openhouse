import { useChainId, useReadContracts } from "wagmi";
import { poolContract } from "../config/contracts";
import { usePoolAddress } from "./useDeployment";

const REFETCH_MS = 5_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export const FacilityStatus = ["Open", "Late", "Defaulted", "Closed"] as const;
export type FacilityStatusName = (typeof FacilityStatus)[number];

export interface FacilityData {
  originator: `0x${string}`;
  limit: bigint;
  firstLoss: bigint;
  principal: bigint;
  fee: bigint;
  tenor: bigint;
  grace: bigint;
  status: number;
  statusName: FacilityStatusName;
  owed: bigint;
  dueAt: bigint;
  lossFirstLoss: bigint;
  lossJunior: bigint;
  lossSenior: bigint;
  defaultReason: string;
  defaultedAt: bigint;
  lateSince: bigint;
}

export function useFacility(id: number) {
  const chainId = useChainId();
  const poolAddress = usePoolAddress();
  const pool = poolContract(poolAddress ?? ZERO_ADDRESS);

  const { data, isLoading, error } = useReadContracts({
    contracts: [
      { ...pool, chainId, functionName: "facilities", args: [BigInt(id)] },
      { ...pool, chainId, functionName: "owedOf", args: [BigInt(id)] },
      { ...pool, chainId, functionName: "dueAtOf", args: [BigInt(id)] },
      { ...pool, chainId, functionName: "lossesOf", args: [BigInt(id)] },
      { ...pool, chainId, functionName: "defaultReasonOf", args: [BigInt(id)] },
      { ...pool, chainId, functionName: "defaultedAtOf", args: [BigInt(id)] },
      { ...pool, chainId, functionName: "lateSinceOf", args: [BigInt(id)] },
    ],
    query: { enabled: !!poolAddress, refetchInterval: REFETCH_MS },
  });

  let facility: FacilityData | undefined;
  if (data && data.every((d) => d.status === "success")) {
    const tuple = data[0].result as readonly [`0x${string}`, bigint, bigint, bigint, bigint, bigint, bigint, number];
    const losses = data[3].result as readonly [bigint, bigint, bigint];
    facility = {
      originator: tuple[0],
      limit: tuple[1],
      firstLoss: tuple[2],
      principal: tuple[3],
      fee: tuple[4],
      tenor: tuple[5],
      grace: tuple[6],
      status: tuple[7],
      statusName: FacilityStatus[tuple[7]],
      owed: data[1].result as bigint,
      dueAt: data[2].result as bigint,
      lossFirstLoss: losses[0],
      lossJunior: losses[1],
      lossSenior: losses[2],
      defaultReason: data[4].result as string,
      defaultedAt: data[5].result as bigint,
      lateSince: data[6].result as bigint,
    };
  }

  return { facility, isLoading, error };
}
