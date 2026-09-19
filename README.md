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
| AnoraPool | [`0xb1dB9407C7D8A60F121193157928B31Ba3481E25`](https://sepolia.arbiscan.io/address/0xb1dB9407C7D8A60F121193157928B31Ba3481E25) |
| TestUSDC | [`0xe092c9607d81D38FB392208D9bc9b6075e0199d2`](https://sepolia.arbiscan.io/address/0xe092c9607d81D38FB392208D9bc9b6075e0199d2) |

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
