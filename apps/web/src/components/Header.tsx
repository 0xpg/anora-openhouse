import { arbitrumSepolia } from "wagmi/chains";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useIsRiskAgent } from "../hooks/usePool";
import type { Page } from "../App";

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Header({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const isRiskAgent = useIsRiskAgent(address);
  const wrongNetwork = isConnected && chainId !== arbitrumSepolia.id;

  const injectedConnector = connectors.find((c) => c.type === "injected") ?? connectors[0];

  return (
    <header className="header">
      <span className="brand-name">Anora</span>
      <nav className="primary-nav" aria-label="Primary navigation">
        <button className={page === "markets" || page === "opportunity" ? "active" : ""} onClick={() => onNavigate("markets")}>Markets</button>
        <button className={page === "portfolio" ? "active" : ""} onClick={() => onNavigate("portfolio")}>Portfolio</button>
        <button className={page === "activity" ? "active" : ""} onClick={() => onNavigate("activity")}>Activity</button>
      </nav>
      <div className="header-actions">
        <button className="network-pill" type="button"><span>◉</span> Arbitrum Sepolia <span>⌄</span></button>
        {wrongNetwork && (
          <button
            className="btn btn-warn"
            disabled={isSwitching}
            onClick={() => switchChain({ chainId: arbitrumSepolia.id })}
          >
            {isSwitching ? "Switching..." : "Switch to Arbitrum Sepolia"}
          </button>
        )}
        {isConnected && address ? (
          <div className="account-pill">
            {isRiskAgent && <span className="badge badge-risk">risk agent</span>}
            <span className="address">{shortenAddress(address)}</span>
            <button className="account-menu" aria-label="Disconnect wallet" onClick={() => disconnect()}>⌄</button>
          </div>
        ) : (
          <button
            className="connect-button"
            disabled={isConnecting || !injectedConnector}
            onClick={() => injectedConnector && connect({ connector: injectedConnector })}
          >
            {isConnecting ? "Connecting..." : "Connect wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
