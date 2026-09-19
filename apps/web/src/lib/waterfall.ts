export interface LossSplit {
  fromFirstLoss: bigint;
  fromJunior: bigint;
  fromSenior: bigint;
}

export interface RecoverySplit {
  toSenior: bigint;
  toJunior: bigint;
  toOriginator: bigint;
}

export interface Losses {
  lossFirstLoss: bigint;
  lossJunior: bigint;
  lossSenior: bigint;
}

export function absorbLoss(loss: bigint, firstLoss: bigint, junior: bigint, senior: bigint): LossSplit {
  const fromFirstLoss = loss < firstLoss ? loss : firstLoss;
  let remaining = loss - fromFirstLoss;

  const fromJunior = remaining < junior ? remaining : junior;
  remaining -= fromJunior;

  const fromSenior = remaining < senior ? remaining : senior;

  return { fromFirstLoss, fromJunior, fromSenior };
}

export function distributeRecovery(amount: bigint, losses: Losses): RecoverySplit {
  const toSenior = amount < losses.lossSenior ? amount : losses.lossSenior;
  let remaining = amount - toSenior;

  const toJunior = remaining < losses.lossJunior ? remaining : losses.lossJunior;
  remaining -= toJunior;

  const toOriginator = remaining < losses.lossFirstLoss ? remaining : losses.lossFirstLoss;

  return { toSenior, toJunior, toOriginator };
}
