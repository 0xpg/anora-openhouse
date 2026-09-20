export function explorerAddressUrl(explorer: string, address: string): string {
  return `${explorer}/address/${address}`;
}

export function explorerTxUrl(explorer: string, hash: string): string {
  return `${explorer}/tx/${hash}`;
}
