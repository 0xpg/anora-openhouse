import { useState } from "react";
import { useAccount } from "wagmi";
import { assetContract, poolContract } from "../config/contracts";
import { useDeployment } from "../hooks/useDeployment";
import { describeContractError } from "../lib/errors";
import { formatDuration, formatUsdc, parseUsdc } from "../lib/format";
import { absorbLoss, distributeRecovery } from "../lib/waterfall";
import { useContractAction } from "../hooks/useContractAction";
import { useFacility } from "../hooks/useFacility";
import { useNow } from "../hooks/useNow";
import { PoolBoard, useAssetAllowance, useIsRiskAgent } from "../hooks/usePool";
import { AddressLink } from "./AddressLink";
import { TxLink } from "./TxLink";

const MAX_UINT256 = 2n ** 256n - 1n;

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Open":
      return "badge badge-open";
    case "Late":
      return "badge badge-late";
    case "Defaulted":
      return "badge badge-defaulted";
    default:
      return "badge badge-closed";
  }
}

export function FacilityCard({ id, board }: { id: number; board: PoolBoard | undefined }) {
  const { address } = useAccount();
  const deployment = useDeployment();
  const { facility, isLoading } = useFacility(id);
  const isRiskAgent = useIsRiskAgent(address);
  const { data: allowance } = useAssetAllowance(address);
  const now = useNow();

  const [drawAmount, setDrawAmount] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [reason, setReason] = useState("");
  const [recoveryAmount, setRecoveryAmount] = useState("");

  const drawdown = useContractAction();
  const repayApprove = useContractAction();
  const repay = useContractAction();
  const markLate = useContractAction();
  const declareDefault = useContractAction();
  const recoveryApprove = useContractAction();
  const recordRecovery = useContractAction();

  if (isLoading || !facility) return <div className="card">Loading facility #{id}...</div>;
  if (!deployment?.pool) return null;

  const assetSymbol = deployment.assetSymbol;
  const asset = assetContract(deployment.asset);
  const pool = poolContract(deployment.pool);

  const isOriginator = address && facility.originator.toLowerCase() === address.toLowerCase();
  const nowSec = BigInt(Math.floor(now / 1000));
  const dueInSec = Number(facility.dueAt - nowSec);
  const maxDraw = facility.limit - facility.principal;
  const drawAmountUnits = parseUsdc(drawAmount);
  const repayAmountUnits = parseUsdc(repayAmount);
  const recoveryAmountUnits = parseUsdc(recoveryAmount);
  const outstandingLoss = facility.lossFirstLoss + facility.lossJunior + facility.lossSenior;

  const canDrawdown =
    !!isOriginator && facility.statusName === "Open" && drawAmountUnits > 0n && drawAmountUnits <= maxDraw;
  const canRepay =
    (facility.statusName === "Open" || facility.statusName === "Late") &&
    repayAmountUnits > 0n &&
    repayAmountUnits <= facility.owed;
  const repayNeedsApproval = repayAmountUnits > 0n && (allowance ?? 0n) < repayAmountUnits;
  const canMarkLate = facility.statusName === "Open" && facility.principal > 0n && dueInSec < 0;

  const graceDeadline = facility.lateSince + facility.grace;
  const graceElapsed = nowSec >= graceDeadline;
  const canDeclareDefault = isRiskAgent && facility.statusName === "Late" && graceElapsed;

  const canRecover =
    facility.statusName === "Defaulted" &&
    recoveryAmountUnits > 0n &&
    recoveryAmountUnits <= outstandingLoss;
  const recoveryNeedsApproval = recoveryAmountUnits > 0n && (allowance ?? 0n) < recoveryAmountUnits;

  const hypotheticalSplit = board
    ? absorbLoss(facility.owed, facility.firstLoss, board.juniorAssets, board.seniorAssets)
    : undefined;
  const recoveryPreview =
    recoveryAmountUnits > 0n
      ? distributeRecovery(recoveryAmountUnits, {
          lossFirstLoss: facility.lossFirstLoss,
          lossJunior: facility.lossJunior,
          lossSenior: facility.lossSenior,
        })
      : undefined;

  return (
    <div className="card">
      <div className="card-head">
        <span className={statusBadgeClass(facility.statusName)}>{facility.statusName}</span>
        <span className="card-title">Facility #{id}</span>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Originator</div>
          <div className="stat-value small">
            <AddressLink address={facility.originator} />
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Limit</div>
          <div className="stat-value">{formatUsdc(facility.limit)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">First loss</div>
          <div className="stat-value">{formatUsdc(facility.firstLoss)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Principal</div>
          <div className="stat-value">{formatUsdc(facility.principal)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Owed (live)</div>
          <div className="stat-value">{formatUsdc(facility.owed)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Due</div>
          <div className="stat-value small">
            {facility.dueAt === 0n
              ? "not drawn yet"
              : facility.statusName === "Defaulted" || facility.statusName === "Closed"
                ? facility.statusName.toLowerCase()
                : dueInSec >= 0
                ? `in ${formatDuration(dueInSec)}`
                : `${formatDuration(-dueInSec)} past due`}
          </div>
        </div>
      </div>

      {facility.statusName === "Late" && (
        <p className="muted">
          {graceElapsed
            ? "Grace period elapsed. Ready for declareDefault."
            : `Grace elapsed in ${formatDuration(Number(graceDeadline - nowSec))}.`}
        </p>
      )}

      {facility.statusName === "Defaulted" && (
        <div className="loss-breakdown">
          <p>
            Default reason: <em>{facility.defaultReason || "(none recorded)"}</em>
          </p>
          <p className="muted">
            Declared at {new Date(Number(facility.defaultedAt) * 1000).toLocaleString()}
          </p>
          <p>
            Losses: first-loss {formatUsdc(facility.lossFirstLoss)} · junior {formatUsdc(facility.lossJunior)} ·
            senior {formatUsdc(facility.lossSenior)}
          </p>
        </div>
      )}

      {facility.statusName === "Open" && hypotheticalSplit && facility.owed > 0n && (
        <p className="muted">
          If defaulted right now, the loss would split first-loss {formatUsdc(hypotheticalSplit.fromFirstLoss)} ·
          junior {formatUsdc(hypotheticalSplit.fromJunior)} · senior {formatUsdc(hypotheticalSplit.fromSenior)}.
        </p>
      )}

      <div className="actions">
        {facility.statusName === "Open" && (
          <div className="row">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Drawdown amount"
              value={drawAmount}
              onChange={(e) => setDrawAmount(e.target.value)}
              disabled={!isOriginator}
            />
            <button
              className="btn"
              disabled={!canDrawdown || drawdown.isPending || drawdown.isConfirming}
              onClick={() =>
                drawdown.writeContractAsync({
                  ...pool,
                  functionName: "drawdown",
                  args: [BigInt(id), drawAmountUnits],
                })
              }
            >
              {drawdown.isPending || drawdown.isConfirming ? "Drawing..." : "Drawdown"}
            </button>
          </div>
        )}
        {drawdown.error && <p className="error">{describeContractError(drawdown.error)}</p>}
        <TxLink hash={drawdown.hash} />

        {(facility.statusName === "Open" || facility.statusName === "Late") && facility.owed > 0n && (
          <div className="row">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Repay amount"
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
            />
            {repayNeedsApproval ? (
              <button
                className="btn"
                disabled={repayApprove.isPending || repayApprove.isConfirming}
                onClick={() =>
                  repayApprove.writeContractAsync({
                    ...asset,
                    functionName: "approve",
                    args: [pool.address, MAX_UINT256],
                  })
                }
              >
                {repayApprove.isPending || repayApprove.isConfirming ? "Approving..." : "Approve"}
              </button>
            ) : (
              <button
                className="btn"
                disabled={!canRepay || repay.isPending || repay.isConfirming}
                onClick={() =>
                  repay.writeContractAsync({
                    ...pool,
                    functionName: "repay",
                    args: [BigInt(id), repayAmountUnits],
                  })
                }
              >
                {repay.isPending || repay.isConfirming ? "Repaying..." : "Repay"}
              </button>
            )}
          </div>
        )}
        {(repayApprove.error || repay.error) && (
          <p className="error">{describeContractError(repayApprove.error ?? repay.error)}</p>
        )}
        <TxLink hash={repay.hash} />

        {facility.statusName === "Open" && (
          <div className="row">
            <button
              className="btn"
              disabled={!canMarkLate || markLate.isPending || markLate.isConfirming}
              onClick={() =>
                markLate.writeContractAsync({ ...pool, functionName: "markLate", args: [BigInt(id)] })
              }
            >
              {markLate.isPending || markLate.isConfirming ? "Marking..." : "Mark late"}
            </button>
          </div>
        )}
        {markLate.error && <p className="error">{describeContractError(markLate.error)}</p>}
        <TxLink hash={markLate.hash} />

        {facility.statusName === "Late" && isRiskAgent && (
          <div className="form-block">
            <textarea
              placeholder="Default reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              className="btn btn-danger"
              disabled={!canDeclareDefault || !reason || declareDefault.isPending || declareDefault.isConfirming}
              onClick={() =>
                declareDefault.writeContractAsync({
                  ...pool,
                  functionName: "declareDefault",
                  args: [BigInt(id), reason],
                })
              }
            >
              {declareDefault.isPending || declareDefault.isConfirming ? "Declaring..." : "Declare default"}
            </button>
          </div>
        )}
        {declareDefault.error && <p className="error">{describeContractError(declareDefault.error)}</p>}
        <TxLink hash={declareDefault.hash} />

        {facility.statusName === "Defaulted" && outstandingLoss > 0n && (
          <div className="row">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Recovery amount"
              value={recoveryAmount}
              onChange={(e) => setRecoveryAmount(e.target.value)}
            />
            {recoveryNeedsApproval ? (
              <button
                className="btn"
                disabled={recoveryApprove.isPending || recoveryApprove.isConfirming}
                onClick={() =>
                  recoveryApprove.writeContractAsync({
                    ...asset,
                    functionName: "approve",
                    args: [pool.address, MAX_UINT256],
                  })
                }
              >
                {recoveryApprove.isPending || recoveryApprove.isConfirming ? "Approving..." : "Approve"}
              </button>
            ) : (
              <button
                className="btn"
                disabled={!canRecover || recordRecovery.isPending || recordRecovery.isConfirming}
                onClick={() =>
                  recordRecovery.writeContractAsync({
                    ...pool,
                    functionName: "recordRecovery",
                    args: [BigInt(id), recoveryAmountUnits],
                  })
                }
              >
                {recordRecovery.isPending || recordRecovery.isConfirming ? "Recording..." : "Record recovery"}
              </button>
            )}
          </div>
        )}
        {recoveryPreview && (
          <p className="muted">
            Preview: senior gets {formatUsdc(recoveryPreview.toSenior)}, junior gets{" "}
            {formatUsdc(recoveryPreview.toJunior)}, originator gets {formatUsdc(recoveryPreview.toOriginator)}{" "}
            {assetSymbol}.
          </p>
        )}
        {(recoveryApprove.error || recordRecovery.error) && (
          <p className="error">{describeContractError(recoveryApprove.error ?? recordRecovery.error)}</p>
        )}
        <TxLink hash={recordRecovery.hash} />
      </div>
    </div>
  );
}
