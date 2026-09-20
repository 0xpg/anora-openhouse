import { useState } from "react";
import { useAccount } from "wagmi";
import { assetContract, poolContract } from "../config/contracts";
import { useDeployment } from "../hooks/useDeployment";
import { formatUsdc, parseUsdc } from "../lib/format";
import { describeContractError } from "../lib/errors";
import { useContractAction } from "../hooks/useContractAction";
import { useAssetAllowance, useAssetBalance, useMyShares } from "../hooks/usePool";
import { TxLink } from "./TxLink";

const MINT_AMOUNT = 100_000n * 10n ** 6n;
const MAX_UINT256 = 2n ** 256n - 1n;

type TrancheChoice = "Senior" | "Junior";

export function CapitalProvider() {
  const { address, isConnected } = useAccount();
  const deployment = useDeployment();
  const [depositTranche, setDepositTranche] = useState<TrancheChoice>("Junior");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawTranche, setWithdrawTranche] = useState<TrancheChoice>("Junior");
  const [withdrawShares, setWithdrawShares] = useState("");

  const { data: assetBalance } = useAssetBalance(address);
  const { data: allowance } = useAssetAllowance(address);
  const shares = useMyShares(address);

  const mint = useContractAction();
  const approve = useContractAction();
  const deposit = useContractAction();
  const withdraw = useContractAction();

  if (!isConnected || !address) {
    return (
      <section className="panel">
        <h2>Capital provider</h2>
        <p className="muted">Connect a wallet to deposit or withdraw.</p>
      </section>
    );
  }

  if (!deployment?.pool) return null;

  const assetSymbol = deployment.assetSymbol;
  const asset = assetContract(deployment.asset);
  const pool = poolContract(deployment.pool);
  const depositAmountUnits = parseUsdc(depositAmount);
  const needsApproval = depositAmountUnits > 0n && (allowance ?? 0n) < depositAmountUnits;

  return (
    <section className="panel">
      <h2>Capital provider</h2>
      <p className="muted">
        {assetSymbol} balance: {assetBalance !== undefined ? formatUsdc(assetBalance) : "..."}
      </p>

      {deployment.faucet ? (
        <div className="row">
          <button
            className="btn"
            disabled={mint.isPending || mint.isConfirming}
            onClick={() =>
              mint.writeContractAsync({
                ...asset,
                functionName: "mint",
                args: [address, MINT_AMOUNT],
              })
            }
          >
            {mint.isPending || mint.isConfirming ? "Minting..." : "Get test USDC (100,000)"}
          </button>
          {mint.error && <span className="error">{describeContractError(mint.error)}</span>}
          <TxLink hash={mint.hash} />
        </div>
      ) : (
        <p className="muted">
          Get {assetSymbol} on Robinhood Chain:{" "}
          <a href="https://docs.robinhood.com/chain/bridging" target="_blank" rel="noreferrer">
            bridging docs
          </a>
          .
        </p>
      )}

      <div className="form-block">
        <h3>Deposit</h3>
        <div className="row">
          <select value={depositTranche} onChange={(e) => setDepositTranche(e.target.value as TrancheChoice)}>
            <option value="Senior">Senior</option>
            <option value="Junior">Junior</option>
          </select>
          <input
            type="text"
            inputMode="decimal"
            placeholder={`Amount ${assetSymbol}`}
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
          {needsApproval ? (
            <button
              className="btn"
              disabled={approve.isPending || approve.isConfirming}
              onClick={() =>
                approve.writeContractAsync({
                  ...asset,
                  functionName: "approve",
                  args: [pool.address, MAX_UINT256],
                })
              }
            >
              {approve.isPending || approve.isConfirming ? "Approving..." : "Approve"}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={deposit.isPending || deposit.isConfirming || depositAmountUnits === 0n}
              onClick={() =>
                deposit.writeContractAsync({
                  ...pool,
                  functionName: "deposit",
                  args: [depositTranche === "Senior" ? 0 : 1, depositAmountUnits],
                })
              }
            >
              {deposit.isPending || deposit.isConfirming ? "Depositing..." : "Deposit"}
            </button>
          )}
        </div>
        {(approve.error || deposit.error) && (
          <span className="error">{describeContractError(approve.error ?? deposit.error)}</span>
        )}
        <TxLink hash={deposit.hash} />
      </div>

      <div className="form-block">
        <h3>Withdraw</h3>
        <p className="muted">
          My shares: Senior {formatUsdc(shares.seniorShares)} · Junior {formatUsdc(shares.juniorShares)}
        </p>
        <div className="row">
          <select value={withdrawTranche} onChange={(e) => setWithdrawTranche(e.target.value as TrancheChoice)}>
            <option value="Senior">Senior</option>
            <option value="Junior">Junior</option>
          </select>
          <input
            type="text"
            inputMode="decimal"
            placeholder={`Shares (1 share = 1 ${assetSymbol} deposited)`}
            value={withdrawShares}
            onChange={(e) => setWithdrawShares(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={withdraw.isPending || withdraw.isConfirming || parseUsdc(withdrawShares) === 0n}
            onClick={() =>
              withdraw.writeContractAsync({
                ...pool,
                functionName: "withdraw",
                args: [withdrawTranche === "Senior" ? 0 : 1, parseUsdc(withdrawShares)],
              })
            }
          >
            {withdraw.isPending || withdraw.isConfirming ? "Withdrawing..." : "Withdraw"}
          </button>
        </div>
        {withdraw.error && <span className="error">{describeContractError(withdraw.error)}</span>}
        <TxLink hash={withdraw.hash} />
      </div>
    </section>
  );
}
