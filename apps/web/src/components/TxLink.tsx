import { useDeployment } from "../hooks/useDeployment";
import { explorerTxUrl } from "../lib/explorer";

export function TxLink({ hash }: { hash: `0x${string}` | undefined }) {
  const deployment = useDeployment();
  if (!hash || !deployment) return null;
  return (
    <a className="tx-link" href={explorerTxUrl(deployment.explorer, hash)} target="_blank" rel="noreferrer">
      View transaction
    </a>
  );
}
