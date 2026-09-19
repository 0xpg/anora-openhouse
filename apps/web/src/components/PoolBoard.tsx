import { formatUsdc } from "../lib/format";
import { usePoolBoard } from "../hooks/usePool";

export function PoolBoard() {
  const { board, isLoading, error } = usePoolBoard();

  if (error) return <section className="panel">Could not load pool state: {error.message}</section>;
  if (isLoading || !board) return <section className="panel">Loading pool state...</section>;

  const stats: Array<[string, string]> = [
    ["Senior assets", formatUsdc(board.seniorAssets)],
    ["Junior assets", formatUsdc(board.juniorAssets)],
    ["First-loss reserve", formatUsdc(board.firstLossReserve)],
    ["Free liquidity", formatUsdc(board.liquidity)],
    ["Senior capacity left", formatUsdc(board.seniorCapacity)],
    ["Pool USDC balance", formatUsdc(board.poolUsdcBalance)],
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
