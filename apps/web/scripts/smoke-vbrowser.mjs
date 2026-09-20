import { getWindow } from "/home/dims/.local/lib/vpsbrowser/browser.mjs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

const url = process.env.SMOKE_URL ?? "https://openhouse.anora.finance/";
const shotDir = process.env.SMOKE_SHOTS ?? "/home/dims/.cache/claude-work/smoke";
const rpc = process.env.ARBITRUM_SEPOLIA_RPC;
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const transport = http(rpc);
const publicClient = createPublicClient({ chain: arbitrumSepolia, transport });
const walletClient = createWalletClient({ account, chain: arbitrumSepolia, transport });
const chainIdHex = "0x" + arbitrumSepolia.id.toString(16);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function walletRequest(method, params) {
  switch (method) {
    case "eth_requestAccounts":
    case "eth_accounts":
      return [account.address];
    case "eth_chainId":
      return chainIdHex;
    case "wallet_switchEthereumChain":
    case "wallet_addEthereumChain":
      return null;
    case "eth_sendTransaction": {
      const tx = params[0];
      return walletClient.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value ? BigInt(tx.value) : undefined,
        gas: tx.gas ? BigInt(tx.gas) : undefined,
      });
    }
    case "personal_sign":
      return account.signMessage({ message: { raw: params[0] } });
    default:
      return publicClient.request({ method, params });
  }
}

const { page } = await getWindow(process.env.VBROWSER_AGENT ?? "smoke");
await page.exposeFunction("__walletRequest", async (method, params) => {
  const result = await walletRequest(method, params);
  return JSON.parse(JSON.stringify(result, (_, v) => (typeof v === "bigint" ? "0x" + v.toString(16) : v)));
});
await page.evaluateOnNewDocument(() => {
  const listeners = {};
  const provider = {
    isMetaMask: true,
    request: ({ method, params }) => window.__walletRequest(method, params ?? []),
    on: (e, fn) => ((listeners[e] ??= []).push(fn), provider),
    removeListener: (e, fn) => ((listeners[e] = (listeners[e] ?? []).filter((f) => f !== fn)), provider),
  };
  window.ethereum = provider;
  const info = { uuid: "5f1c2a2e-0000-4000-8000-000000000001", name: "Smoke Wallet", icon: "data:image/svg+xml,", rdns: "xyz.dimsky.smoke" };
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
});

let step = 0;
async function shot(name) {
  step += 1;
  const file = `${shotDir}/${String(step).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(`shot ${file}`);
}

async function clickButton(text, { timeout = 60_000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const clicked = await page.evaluate((t) => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === t && !b.disabled);
      if (!btn) return false;
      btn.click();
      return true;
    }, text);
    if (clicked) {
      console.log(`click ${text}`);
      return;
    }
    await sleep(500);
  }
  throw new Error(`button not clickable: ${text}`);
}

async function waitForButton(text, { timeout = 120_000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const ok = await page.evaluate((t) => [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === t && !b.disabled), text);
    if (ok) return;
    await sleep(500);
  }
  throw new Error(`button never enabled: ${text}`);
}

async function waitForText(text, { timeout = 120_000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), text)) return;
    await sleep(500);
  }
  throw new Error(`text never appeared: ${text}`);
}

async function setInput(selector, value, { index = 0 } = {}) {
  await page.evaluate(
    ({ selector, value, index }) => {
      const el = document.querySelectorAll(selector)[index];
      if (!el) throw new Error(`no element ${selector}[${index}]`);
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    { selector, value, index },
  );
}

async function setLabeledInput(labelText, value) {
  await page.evaluate(
    ({ labelText, value }) => {
      const label = [...document.querySelectorAll("label")].find((l) => l.innerText.trim().startsWith(labelText));
      const el = label?.querySelector("input");
      if (!el) throw new Error(`no input under label ${labelText}`);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    { labelText, value },
  );
}

async function setSelect(index, value) {
  await page.evaluate(
    ({ index, value }) => {
      const el = document.querySelectorAll("select")[index];
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, value);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { index, value },
  );
}

async function pageText() {
  return page.evaluate(() => document.body.innerText);
}

const tenorMinutes = Number(process.env.SMOKE_TENOR_MIN ?? "2");
const graceMinutes = Number(process.env.SMOKE_GRACE_MIN ?? "1");

console.log(`wallet ${account.address}`);
await page.goto(url, { waitUntil: "networkidle2" });
await shot("landing");
const resumeAt = process.env.SMOKE_RESUME ?? "";
if (resumeAt === "default") {
  step = 8;
  await waitForText(account.address.slice(0, 6));
  await runDefaultAndRecovery();
}

const alreadyConnected = await page.evaluate((prefix) => document.body.innerText.includes(prefix), account.address.slice(0, 6));
if (!alreadyConnected) await clickButton("Connect wallet");
await waitForText(account.address.slice(0, 6));
await shot("connected");

await clickButton("Get test USDC (100,000)");
await waitForButton("Get test USDC (100,000)");
await shot("minted");

await setSelect(0, "Junior");
await setInput('input[placeholder="Amount TestUSDC"]', "10000");
if (await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "Approve" && !b.disabled))) {
  await clickButton("Approve");
  await waitForButton("Deposit");
}
await clickButton("Deposit");
await waitForText("10,000");
await shot("junior-deposited");

await setSelect(0, "Senior");
await setInput('input[placeholder="Amount TestUSDC"]', "20000");
await clickButton("Deposit");
await waitForText("20,000");
await shot("senior-deposited");

await setLabeledInput("Credit limit", "20000");
await setLabeledInput("First-loss stake", "2000");
await setLabeledInput("Tenor", String(tenorMinutes));
await setLabeledInput("Grace period", String(graceMinutes));
const needsStakeApproval = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => b.innerText.trim() === "Approve first-loss stake" && !b.disabled));
if (needsStakeApproval) {
  await clickButton("Approve first-loss stake");
  await waitForButton("Open facility");
}
await clickButton("Open facility");
await waitForText("#0");
await shot("facility-opened");

await setInput('input[placeholder="Drawdown amount"]', "15000");
await clickButton("Drawdown");
await waitForButton("Mark late", { timeout: (tenorMinutes + 2) * 60_000 });
await shot("drawn-and-past-due");

await clickButton("Mark late");
await waitForText("Late");
await shot("marked-late");

await runDefaultAndRecovery();

async function runDefaultAndRecovery() {
await setInput('textarea[placeholder="Default reason"]', "buyer failed to pay; restructuring refused");
await waitForButton("Declare default", { timeout: (graceMinutes + 2) * 60_000 });
await clickButton("Declare default");
await waitForText("Defaulted");
await shot("defaulted");

const needsRecoveryApproval = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")].filter((b) => b.innerText.trim() === "Approve" && !b.disabled);
  return btns.length > 0;
});
await setInput('input[placeholder="Recovery amount"]', "9000");
if (needsRecoveryApproval) {
  await clickButton("Approve");
  await waitForButton("Record recovery");
}
await clickButton("Record recovery");
await sleep(8_000);
await shot("recovered");

console.log("---- final page text ----");
console.log(await pageText());
process.exit(0);
}
