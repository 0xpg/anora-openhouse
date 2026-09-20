import { useDeployment } from "../hooks/useDeployment";
import { usePolicy, usePoolBoard } from "../hooks/usePool";
import { formatUsdc } from "../lib/format";

export function PoolBoard() {
  const { board, isLoading, error } = usePoolBoard();
  const { data: policy } = usePolicy();
  const deployment = useDeployment();
  const assetSymbol = deployment?.assetSymbol ?? "";

  if (error) return <section className="panel">Could not load pool state: {error.message}</section>;
  if (isLoading || !board) return <section className="panel">Loading pool state...</section>;

  const depositCap = policy ? (policy as readonly bigint[])[5] : undefined;
  const totalCapital = board.seniorAssets + board.juniorAssets;

  const stats: Array<[string, string]> = [
    ["Senior assets", formatUsdc(board.seniorAssets)],
    ["Junior assets", formatUsdc(board.juniorAssets)],
    ["First-loss reserve", formatUsdc(board.firstLossReserve)],
    ["Free liquidity", formatUsdc(board.liquidity)],
    ["Senior capacity left", formatUsdc(board.seniorCapacity)],
    [`Pool ${assetSymbol} balance`, formatUsdc(board.poolAssetBalance)],
    [
      "Total capital / cap",
      depositCap !== undefined ? `${formatUsdc(totalCapital)} / ${formatUsdc(depositCap)}` : formatUsdc(totalCapital),
    ],
  ];

  return (
    <section className="panel">
      <h2>Pool board</h2>
      <div className="stat-grid">
        {stats.map(([label, value]) => (
          <div className="stat" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
