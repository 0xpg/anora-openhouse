import { arbitrumSepolia } from "wagmi/chains";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useIsRiskAgent } from "../hooks/usePool";

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Header() {
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
      <div className="header-brand">
        <span className="brand-name">Anora</span>
        <span className="brand-sub">Open House</span>
      </div>
      <div className="header-actions">
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
            <button className="btn btn-ghost" onClick={() => disconnect()}>
              Disconnect
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary"
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
