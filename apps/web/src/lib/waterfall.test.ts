import { describe, expect, it } from "vitest";
import { absorbLoss, distributeRecovery } from "./waterfall";

describe("absorbLoss", () => {
  it("absorbs a full-limit loss first loss then junior then senior, per Scenario.t.sol", () => {
    const split = absorbLoss(300_000n, 30_000n, 90_000n, 270_000n);
    expect(split.fromFirstLoss).toBe(30_000n);
    expect(split.fromJunior).toBe(90_000n);
    expect(split.fromSenior).toBe(180_000n);
  });

  it("stops at first loss when the loss is smaller than the first-loss reserve", () => {
    const split = absorbLoss(10_000n, 30_000n, 90_000n, 270_000n);
    expect(split.fromFirstLoss).toBe(10_000n);
    expect(split.fromJunior).toBe(0n);
    expect(split.fromSenior).toBe(0n);
  });

  it("caps senior loss at the senior balance even if the loss is larger", () => {
    const split = absorbLoss(1_000_000n, 30_000n, 90_000n, 270_000n);
    expect(split.fromFirstLoss).toBe(30_000n);
    expect(split.fromJunior).toBe(90_000n);
    expect(split.fromSenior).toBe(270_000n);
  });

  it("returns all zeros for zero loss", () => {
    const split = absorbLoss(0n, 30_000n, 90_000n, 270_000n);
    expect(split.fromFirstLoss).toBe(0n);
    expect(split.fromJunior).toBe(0n);
    expect(split.fromSenior).toBe(0n);
  });
});

describe("distributeRecovery", () => {
  it("pays senior first then junior then the originator's first loss, per Scenario.t.sol", () => {
    const split = distributeRecovery(200_000n, {
      lossFirstLoss: 30_000n,
      lossJunior: 90_000n,
      lossSenior: 180_000n,
    });
    expect(split.toSenior).toBe(180_000n);
    expect(split.toJunior).toBe(20_000n);
    expect(split.toOriginator).toBe(0n);
  });

  it("returns the leftover to the originator once senior and junior are made whole", () => {
    const split = distributeRecovery(300_000n, {
      lossFirstLoss: 30_000n,
      lossJunior: 90_000n,
      lossSenior: 180_000n,
    });
    expect(split.toSenior).toBe(180_000n);
    expect(split.toJunior).toBe(90_000n);
    expect(split.toOriginator).toBe(30_000n);
  });

  it("pays only senior when the recovery is smaller than the senior loss", () => {
    const split = distributeRecovery(50_000n, {
      lossFirstLoss: 30_000n,
      lossJunior: 90_000n,
      lossSenior: 180_000n,
    });
    expect(split.toSenior).toBe(50_000n);
    expect(split.toJunior).toBe(0n);
    expect(split.toOriginator).toBe(0n);
  });
});
