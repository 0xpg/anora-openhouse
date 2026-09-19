import { useReadContracts } from "wagmi";
import { anoraPoolContract } from "../config/contracts";

const REFETCH_MS = 5_000;

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
}

export function useFacility(id: number) {
  const { data, isLoading, error } = useReadContracts({
    contracts: [
      { ...anoraPoolContract, functionName: "facilities", args: [BigInt(id)] },
      { ...anoraPoolContract, functionName: "owedOf", args: [BigInt(id)] },
      { ...anoraPoolContract, functionName: "dueAtOf", args: [BigInt(id)] },
      { ...anoraPoolContract, functionName: "lossesOf", args: [BigInt(id)] },
      { ...anoraPoolContract, functionName: "defaultReasonOf", args: [BigInt(id)] },
      { ...anoraPoolContract, functionName: "defaultedAtOf", args: [BigInt(id)] },
    ],
    query: { refetchInterval: REFETCH_MS },
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
    };
  }

  return { facility, isLoading, error };
}
