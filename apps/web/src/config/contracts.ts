import type { Address } from "viem";
import { AnoraPoolAbi, TestUSDCAbi } from "../abi";

export const anoraPoolAddress: Address = "0xb1dB9407C7D8A60F121193157928B31Ba3481E25";
export const testUsdcAddress: Address = "0xe092c9607d81D38FB392208D9bc9b6075e0199d2";
export const riskAgentAddress: Address = "0x07dF8cd6D20b71ba7F16309d2844B88d1043fFfB";

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
