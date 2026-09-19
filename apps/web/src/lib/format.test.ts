import { describe, expect, it } from "vitest";
import { formatDuration, formatUsdc, parseUsdc } from "./format";

describe("formatUsdc", () => {
  it("formats whole units with thousands separators", () => {
    expect(formatUsdc(300_000_000_000n)).toBe("300,000");
  });

  it("formats fractional units with at most two fraction digits", () => {
    expect(formatUsdc(1_234_567n)).toBe("1.23");
  });

  it("drops trailing fraction zeros", () => {
    expect(formatUsdc(1_000_000n)).toBe("1");
  });

  it("formats zero", () => {
    expect(formatUsdc(0n)).toBe("0");
  });
});

describe("parseUsdc", () => {
  it("parses a whole number into base units", () => {
    expect(parseUsdc("100000")).toBe(100_000_000_000n);
  });

  it("parses a decimal into base units", () => {
    expect(parseUsdc("1.5")).toBe(1_500_000n);
  });

  it("truncates extra fraction digits beyond 6 decimals", () => {
    expect(parseUsdc("1.1234567")).toBe(1_123_456n);
  });

  it("treats an empty string as zero", () => {
    expect(parseUsdc("")).toBe(0n);
  });
});

describe("formatDuration", () => {
  it("renders minutes for short spans", () => {
    expect(formatDuration(300)).toBe("5m");
  });

  it("renders days and hours for long spans", () => {
    expect(formatDuration(90 * 86400 + 3 * 3600)).toBe("90d 3h");
  });

  it("renders zero for non-positive input", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(-10)).toBe("0m");
  });
});
