import { useState } from "react";
import { useAccount } from "wagmi";
import { assetContract, poolContract } from "../config/contracts";
import { useDeployment } from "../hooks/useDeployment";
import { describeContractError } from "../lib/errors";
import { formatUsdc, parseUsdc } from "../lib/format";
import { useContractAction } from "../hooks/useContractAction";
import { useAssetAllowance, usePolicy } from "../hooks/usePool";
import { TxLink } from "./TxLink";

const MAX_UINT256 = 2n ** 256n - 1n;

export function Originator() {
  const { address, isConnected } = useAccount();
  const deployment = useDeployment();
  const { data: policy } = usePolicy();
  const { data: allowance } = useAssetAllowance(address);
  const [limit, setLimit] = useState("");
  const [firstLoss, setFirstLoss] = useState("");
  const [tenorMinutes, setTenorMinutes] = useState("");
  const [graceMinutes, setGraceMinutes] = useState("");

  const approve = useContractAction();
  const open = useContractAction();

  if (!isConnected || !address) {
    return (
      <section className="panel">
        <h2>Originator</h2>
        <p className="muted">Connect a wallet to open a facility.</p>
      </section>
    );
  }

  if (!deployment?.pool) return null;

  const assetSymbol = deployment.assetSymbol;
  const asset = assetContract(deployment.asset);
  const pool = poolContract(deployment.pool);

  const minFirstLossBps = policy ? (policy as readonly bigint[])[1] : undefined;
  const limitUnits = parseUsdc(limit);
  const firstLossUnits = parseUsdc(firstLoss);
  const minFirstLoss = minFirstLossBps !== undefined ? (limitUnits * minFirstLossBps) / 10_000n : 0n;

  const canOpen =
    limitUnits > 0n && firstLossUnits >= minFirstLoss && tenorMinutes !== "" && graceMinutes !== "";
  const needsApproval = firstLossUnits > 0n && (allowance ?? 0n) < firstLossUnits;

  return (
    <section className="panel">
      <h2>Originator</h2>
      <p className="muted">
        Tenor and grace are entered in minutes for this demo (converted to seconds onchain).
      </p>
      <div className="form-grid">
        <label>
          Credit limit ({assetSymbol})
          <input type="text" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </label>
        <label>
          First-loss stake ({assetSymbol})
          <input
            type="text"
            inputMode="decimal"
            value={firstLoss}
            onChange={(e) => setFirstLoss(e.target.value)}
          />
        </label>
        <label>
          Tenor (minutes)
          <input
            type="text"
            inputMode="numeric"
            value={tenorMinutes}
            onChange={(e) => setTenorMinutes(e.target.value)}
          />
        </label>
        <label>
          Grace period (minutes)
          <input
            type="text"
            inputMode="numeric"
            value={graceMinutes}
            onChange={(e) => setGraceMinutes(e.target.value)}
          />
        </label>
      </div>
      {minFirstLossBps !== undefined && limitUnits > 0n && (
        <p className="muted">
          Minimum first-loss required: {formatUsdc(minFirstLoss)} {assetSymbol}
        </p>
      )}
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
          {approve.isPending || approve.isConfirming ? "Approving..." : "Approve first-loss stake"}
        </button>
      ) : (
        <button
          className="btn btn-primary"
          disabled={!canOpen || open.isPending || open.isConfirming}
          onClick={() =>
            open.writeContractAsync({
              ...pool,
              functionName: "openFacility",
              args: [
                limitUnits,
                firstLossUnits,
                BigInt(Math.round(Number(tenorMinutes) * 60)),
                BigInt(Math.round(Number(graceMinutes) * 60)),
              ],
            })
          }
        >
          {open.isPending || open.isConfirming ? "Opening..." : "Open facility"}
        </button>
      )}
      {(approve.error || open.error) && (
        <p className="error">{describeContractError(approve.error ?? open.error)}</p>
      )}
      <TxLink hash={open.hash} />
    </section>
  );
}
