# Anora Open House

Onchain credit pool for curated originators. Capital providers deposit into a
single pool split into Senior and Junior tranches; originators open facilities,
stake first-loss capital in Junior, draw liquidity, and repay with a financing
fee. Late payments pause drawdown automatically. Default is declared by a risk
agent with the reason recorded onchain, first-loss capital absorbs the loss
first, and recoveries flow back through the waterfall, Senior first.

Built for the Arbitrum Open House Singapore 2026 buildathon. Target chain:
Arbitrum Sepolia.

| Contract | Arbitrum Sepolia |
|---|---|
| AnoraPool | [`0x00cAFA8a1B5eF3514C21138DB74d909372E8F156`](https://sepolia.arbiscan.io/address/0x00cAFA8a1B5eF3514C21138DB74d909372E8F156) |
| TestUSDC | [`0x8Ac1601Bc9E2495401d5da5f3086ec548673b5e0`](https://sepolia.arbiscan.io/address/0x8Ac1601Bc9E2495401d5da5f3086ec548673b5e0) |

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
TestUSDC on Arbitrum Sepolia through an injected wallet (MetaMask). Plain CSS,
no UI framework.

```
bun run dev:web      # http://127.0.0.1:5173
bun run build:web     # type-checks then builds apps/web/dist
bun run test:web      # vitest: waterfall math + formatting helpers
```

ABIs are generated, not hand-written: `bun scripts/export-abi.ts` reads
`contracts/out/{AnoraPool,TestUSDC}.sol/*.json` (run `forge build` in
`contracts/` first) and writes `apps/web/src/abi/*.ts` as `as const` arrays.
Re-run it whenever the contract's interface changes, and commit the output.

**Tenor-in-minutes demo convention**: `AnoraPool.openFacility` takes `tenor`
and `grace` in seconds, but Arbitrum Sepolia is a live network we cannot warp
time on. The Originator form takes both in **minutes** and multiplies by 60
before sending the transaction, so a demo facility can go from Open to
markLate-eligible in a couple of minutes instead of days.

