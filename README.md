# Anora Open House

Onchain credit pool for curated originators. Capital providers deposit into a
single pool split into Senior and Junior tranches; originators open facilities,
stake first-loss capital in Junior, draw liquidity, and repay with a financing
fee. Late payments pause drawdown automatically. Default is declared by a risk
agent with the reason recorded onchain, first-loss capital absorbs the loss
first, and recoveries flow back through the waterfall, Senior first.

Built for the Arbitrum Open House Singapore 2026 buildathon. Target chain:
Arbitrum Sepolia.

| Contract | Robinhood Chain (mainnet, USDG) |
|---|---|
| AnoraPool | [`0xe092c9607d81D38FB392208D9bc9b6075e0199d2`](https://robinhoodchain.blockscout.com/address/0xe092c9607d81D38FB392208D9bc9b6075e0199d2) |
| USDG | [`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`](https://robinhoodchain.blockscout.com/address/0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168) |

| Contract | Arbitrum Sepolia |
|---|---|
| AnoraPool | [`0x45FD61Fe12E13C5f722F10178aED4067224f2e20`](https://sepolia.arbiscan.io/address/0x45FD61Fe12E13C5f722F10178aED4067224f2e20) |
| TestUSDC | [`0x382b7722f814d3DCF958B1938a63C4e15B6Db2D6`](https://sepolia.arbiscan.io/address/0x382b7722f814d3DCF958B1938a63C4e15B6Db2D6) |

Monorepo, Bun workspaces.

```
contracts/   Foundry: AnoraPool, tests, deploy script
apps/        web and api (coming)
packages/    shared code (coming)
```

```
bun install
bun run test:contracts
```

## apps/web

Live demo build: https://openhouse.anora.finance (redeploy with `bin/deploy-web.sh`).


Vite + React + TypeScript + wagmi v2 + viem, talking directly to AnoraPool and
its pool asset through an injected wallet (MetaMask). Plain CSS, no UI
framework.

```
bun run dev:web      # http://127.0.0.1:5173
bun run build:web     # type-checks then builds apps/web/dist
bun run test:web      # vitest: waterfall math, formatting helpers, deployments map
```

### Supported networks

| Network | Chain ID | Asset | Faucet |
|---|---|---|---|
| Arbitrum Sepolia | 421614 | TestUSDC | yes, `mint(address,uint256)` |
| Robinhood Chain | 4663 | USDG | no |

`contracts/deployments.json` is the single source of truth for both networks:
pool address, asset address and symbol, whether the asset has a public
faucet, and the block explorer base URL. `apps/web/src/config/deployments.ts`
imports that file directly (`resolveJsonModule`) and exposes
`deploymentFor(chainId)`; nothing about a network is hardcoded in the UI
beyond the chain definitions in `apps/web/src/config/wagmi.ts`. The header's
network selector calls `switchChain`, and every read/write hook pulls its
pool/asset address from `useDeployment()` (`apps/web/src/hooks/useDeployment.ts`),
keyed by the connected `chainId` so switching networks never shows stale
data. When a chain has no pool deployed yet (`AnoraPool: null` in
`deployments.json`, currently Robinhood Chain) or isn't in the file at all,
the app shows a "not deployed yet" card with a chain switcher instead of the
pool board. Once Robinhood Chain's AnoraPool address is filled into
`deployments.json`, the UI picks it up with no code change.

ABIs are generated, not hand-written: `bun scripts/export-abi.ts` reads
`contracts/out/{AnoraPool,TestUSDC}.sol/*.json` (run `forge build` in
`contracts/` first) and writes `apps/web/src/abi/*.ts` as `as const` arrays.
Re-run it whenever the contract's interface changes, and commit the output.
The generated `TestUSDCAbi` is a plain ERC-20 subset (balanceOf, allowance,
approve, mint) reused for USDG on Robinhood Chain; the mint button only
renders when the active network's `faucet` flag is true.

**Tenor-in-minutes demo convention**: `AnoraPool.openFacility` takes `tenor`
and `grace` in seconds, but Arbitrum Sepolia is a live network we cannot warp
time on. The Originator form takes both in **minutes** and multiplies by 60
before sending the transaction, so a demo facility can go from Open to
markLate-eligible in a couple of minutes instead of days.

