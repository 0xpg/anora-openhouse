import { getWindow } from "/home/dims/.local/lib/vpsbrowser/browser.mjs";
import { execFileSync } from "node:child_process";

const [address, contractPath] = process.argv.slice(2);
if (!address || !contractPath) {
  console.error("usage: node scripts/verify-blockscout.mjs <address> <src/File.sol:Contract> [chainId] [explorer]");
  process.exit(2);
}
const chainId = process.argv[4] ?? "4663";
const base = process.argv[5] ?? "https://robinhoodchain.blockscout.com";
const compiler = process.env.SOLC_LONG_VERSION ?? "v0.8.28+commit.7893614a";
const forge = `${process.env.HOME}/.foundry/bin/forge`;
const std = execFileSync(forge, ["verify-contract", "--show-standard-json-input", "--chain-id", chainId, address, contractPath], {
  cwd: new URL("../contracts/", import.meta.url).pathname,
  encoding: "utf8",
});

const { page } = await getWindow(process.env.VBROWSER_AGENT ?? "verify");
await page.goto(`${base}/api/v2/smart-contracts/${address}`, { waitUntil: "domcontentloaded" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const status = () => page.evaluate(async (u) => (await fetch(u)).json(), `${base}/api/v2/smart-contracts/${address}`);
if ((await status()).is_verified) {
  console.log("already verified");
  process.exit(0);
}
const res = await page.evaluate(async ({ base, address, std, compiler }) => {
  const fd = new FormData();
  fd.append("compiler_version", compiler);
  fd.append("license_type", "mit");
  fd.append("autodetect_constructor_args", "true");
  fd.append("files[0]", new Blob([std], { type: "application/json" }), "standard-input.json");
  const r = await fetch(`${base}/api/v2/smart-contracts/${address}/verification/via/standard-input`, { method: "POST", body: fd });
  return { status: r.status, text: (await r.text()).slice(0, 300) };
}, { base, address, std, compiler });
console.log("submitted:", JSON.stringify(res));
for (let i = 0; i < 24; i++) {
  await sleep(5000);
  const s = await status();
  if (s.is_verified) {
    console.log(`verified: ${s.name} ${base}/address/${address}?tab=contract`);
    process.exit(0);
  }
}
console.error("not verified after 2 minutes");
process.exit(1);
