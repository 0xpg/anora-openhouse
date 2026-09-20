import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { AddressLink } from "./AddressLink";
import { robinhood } from "../config/wagmi";
import { useDeployment } from "../hooks/useDeployment";
import { useIsRiskAgent } from "../hooks/usePool";
import { shortenAddress } from "../lib/format";

const SELECTABLE_CHAINS = [
  { id: arbitrumSepolia.id, name: "Arbitrum Sepolia" },
  { id: robinhood.id, name: "Robinhood Chain" },
];

export function Header() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const isRiskAgent = useIsRiskAgent(address);
  const deployment = useDeployment();
  const isSupportedChain = SELECTABLE_CHAINS.some((chain) => chain.id === chainId);

  const injectedConnector = connectors.find((c) => c.type === "injected") ?? connectors[0];

  return (
    <header className="header">
      <div className="header-brand">
        <span className="brand-name">Anora</span>
        <span className="brand-sub">Open House</span>
      </div>
      <div className="header-actions">
        <div className="network-select">
          {SELECTABLE_CHAINS.map((chain) => (
            <button
              key={chain.id}
              className={chain.id === chainId ? "btn btn-network btn-network-active" : "btn btn-network"}
              disabled={isSwitching || !isConnected}
              onClick={() => switchChain({ chainId: chain.id })}
            >
              {chain.name}
            </button>
          ))}
        </div>
        {isConnected && !isSupportedChain && <span className="btn btn-warn">Unsupported network</span>}
        {deployment && (
          <>
            <span className="asset-pill">{deployment.assetSymbol}</span>
            {deployment.pool && (
              <AddressLink className="pool-link" address={deployment.pool} />
            )}
          </>
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
