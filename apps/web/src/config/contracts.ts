import type { Address } from "viem";
import { AnoraPoolAbi, TestUSDCAbi } from "../abi";

export const anoraPoolAddress: Address = "0x45FD61Fe12E13C5f722F10178aED4067224f2e20";
export const testUsdcAddress: Address = "0x382b7722f814d3DCF958B1938a63C4e15B6Db2D6";

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
