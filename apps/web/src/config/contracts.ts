import type { Address } from "viem";
import { AnoraPoolAbi, TestUSDCAbi } from "../abi";

export const anoraPoolAddress: Address = "0x00cAFA8a1B5eF3514C21138DB74d909372E8F156";
export const testUsdcAddress: Address = "0x8Ac1601Bc9E2495401d5da5f3086ec548673b5e0";

export const anoraPoolContract = {
  address: anoraPoolAddress,
  abi: AnoraPoolAbi,
} as const;

export const testUsdcContract = {
  address: testUsdcAddress,
  abi: TestUSDCAbi,
} as const;

export const USDC_DECIMALS = 6;
export const BPS = 10_000n;
