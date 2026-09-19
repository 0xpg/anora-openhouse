const USDC_DECIMALS = 6;

const usdcFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatUsdc(amount: bigint): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const base = 10n ** BigInt(USDC_DECIMALS);
  const whole = abs / base;
  const fraction = abs % base;
  const value = Number(whole) + Number(fraction) / Number(base);
  const formatted = usdcFormatter.format(value);
  return negative ? `-${formatted}` : formatted;
}

export function parseUsdc(input: string): bigint {
  const trimmed = input.trim();
  if (trimmed === "") return 0n;
  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const wholeDigits = wholePart.replace(/[^0-9]/g, "") || "0";
  const fractionDigits = fractionPart.replace(/[^0-9]/g, "").slice(0, USDC_DECIMALS);
  const paddedFraction = fractionDigits.padEnd(USDC_DECIMALS, "0");
  return BigInt(wholeDigits) * 10n ** BigInt(USDC_DECIMALS) + BigInt(paddedFraction || "0");
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && minutes > 0) parts.push(`${minutes}m`);
  if (days === 0 && hours === 0 && minutes === 0) parts.push(`${secs}s`);
  return parts.join(" ") || "0s";
}
