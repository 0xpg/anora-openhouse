import { useDeployment } from "../hooks/useDeployment";
import { explorerAddressUrl } from "../lib/explorer";
import { shortenAddress } from "../lib/format";

export function AddressLink({ address, className }: { address: `0x${string}`; className?: string }) {
  const deployment = useDeployment();
  const label = shortenAddress(address);
  if (!deployment) return <span className={className}>{label}</span>;
  return (
    <a
      className={className}
      href={explorerAddressUrl(deployment.explorer, address)}
      target="_blank"
      rel="noreferrer"
    >
      {label}
    </a>
  );
}
