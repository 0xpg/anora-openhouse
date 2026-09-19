import { createConfig, http, injected } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  connectors: [injected()],
  transports: {
    [arbitrumSepolia.id]: http("https://sepolia-rollup.arbitrum.io/rpc"),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
