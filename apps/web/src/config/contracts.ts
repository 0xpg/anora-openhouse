import type { Address } from "viem";
import { AnoraPoolAbi, TestUSDCAbi } from "../abi";

export function poolContract(address: Address) {
  return { address, abi: AnoraPoolAbi } as const;
}

export function assetContract(address: Address) {
  return { address, abi: TestUSDCAbi } as const;
}

export const BPS = 10_000n;
