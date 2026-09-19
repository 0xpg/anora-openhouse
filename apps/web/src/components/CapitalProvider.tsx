import { useState } from "react";
import { useAccount } from "wagmi";
import { anoraPoolContract, testUsdcContract } from "../config/contracts";
import { formatUsdc, parseUsdc } from "../lib/format";
import { describeContractError } from "../lib/errors";
import { useContractAction } from "../hooks/useContractAction";
import { useMyShares, useUsdcAllowance, useUsdcBalance } from "../hooks/usePool";

const MINT_AMOUNT = 100_000n * 10n ** 6n;
const MAX_UINT256 = 2n ** 256n - 1n;

type TrancheChoice = "Senior" | "Junior";

export function CapitalProvider() {
  const { address, isConnected } = useAccount();
  const [depositTranche, setDepositTranche] = useState<TrancheChoice>("Junior");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawTranche, setWithdrawTranche] = useState<TrancheChoice>("Junior");
  const [withdrawShares, setWithdrawShares] = useState("");

  const { data: usdcBalance } = useUsdcBalance(address);
  const { data: allowance } = useUsdcAllowance(address);
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

  const depositAmountUnits = parseUsdc(depositAmount);
  const needsApproval = depositAmountUnits > 0n && (allowance ?? 0n) < depositAmountUnits;

  return (
    <section className="panel">
      <h2>Capital provider</h2>
      <p className="muted">USDC balance: {usdcBalance !== undefined ? formatUsdc(usdcBalance) : "..."}</p>

      <div className="row">
        <button
          className="btn"
          disabled={mint.isPending || mint.isConfirming}
          onClick={() =>
            mint.writeContractAsync({
              ...testUsdcContract,
              functionName: "mint",
              args: [address, MINT_AMOUNT],
            })
          }
        >
          {mint.isPending || mint.isConfirming ? "Minting..." : "Get test USDC (100,000)"}
        </button>
        {mint.error && <span className="error">{describeContractError(mint.error)}</span>}
      </div>

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
            placeholder="Amount USDC"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
          {needsApproval ? (
            <button
              className="btn"
              disabled={approve.isPending || approve.isConfirming}
              onClick={() =>
                approve.writeContractAsync({
                  ...testUsdcContract,
                  functionName: "approve",
                  args: [anoraPoolContract.address, MAX_UINT256],
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
                  ...anoraPoolContract,
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
      </div>

      <div className="form-block">
        <h3>Withdraw</h3>
        <p className="muted">
          My shares: Senior {shares.seniorShares.toString()} · Junior {shares.juniorShares.toString()}
        </p>
        <div className="row">
          <select value={withdrawTranche} onChange={(e) => setWithdrawTranche(e.target.value as TrancheChoice)}>
            <option value="Senior">Senior</option>
            <option value="Junior">Junior</option>
          </select>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Shares"
            value={withdrawShares}
            onChange={(e) => setWithdrawShares(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={withdraw.isPending || withdraw.isConfirming || !withdrawShares}
            onClick={() =>
              withdraw.writeContractAsync({
                ...anoraPoolContract,
                functionName: "withdraw",
                args: [withdrawTranche === "Senior" ? 0 : 1, BigInt(withdrawShares || "0")],
              })
            }
          >
            {withdraw.isPending || withdraw.isConfirming ? "Withdrawing..." : "Withdraw"}
          </button>
        </div>
        {withdraw.error && <span className="error">{describeContractError(withdraw.error)}</span>}
      </div>
    </section>
  );
}
