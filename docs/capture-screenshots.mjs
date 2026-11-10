import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] ?? "http://localhost:5173";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "screenshots");
const PORT = 9339;
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const PAGES = [
  ["02-graphing-calculator", "/graph"],
  ["03-projectile-motion", "/projectile"],
  ["04-calculus-visualizer", "/calculus"],
  ["05-dfa-nfa-simulator", "/automata"],
  ["06-pda-simulator", "/pda"],
  ["07-turing-machine", "/turing"],
  ["08-ncert-home", "/ncert"],
  ["09-ncert-class-11", "/ncert/class/11"],
  ["10-ncert-chapter", "/ncert/chapter/c11-limits-and-derivatives"],
  ["11-engineering-lab", "/lab"],
  ["12-lab-experiment", "/lab/simple-pendulum"],
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "mle-shots-"));
const chrome = spawn(CHROME, ["--headless=new", "--hide-scrollbars", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
      const ws = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
      return ws;
    } catch {
      await wait(200);
    }
  }
  throw new Error("Chrome did not start; set CHROME to your browser binary");
}

const ws = await connect();
const pending = new Map();
let seq = 0;
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  pending.get(d.id)?.(d.result);
  pending.delete(d.id);
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = (expression) => send("Runtime.evaluate", { expression });
const setTheme = (theme) => evaluate(`localStorage.setItem("mle-settings", JSON.stringify({ state: { theme: "${theme}" }, version: 0 }))`);
const viewport = (width, height) => send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 800 });

async function open(path) {
  await send("Page.navigate", { url: BASE + path });
  await wait(3000);
}

async function shot(name, { full = false, width = 1440, height = 900 } = {}) {
  await viewport(width, height);
  await wait(400);
  if (full) {
    const metrics = await send("Page.getLayoutMetrics");
    await viewport(width, Math.min(4000, Math.ceil(metrics.cssContentSize.height)));
    await wait(500);
  }
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
  await viewport(width, height);
  console.log(`saved ${name}.png`);
}

try {
  mkdirSync(OUT, { recursive: true });
  await send("Page.enable");
  await viewport(1440, 900);
  await open("/");
  await setTheme("light");

  for (const [name, path] of PAGES) {
    await open(path);
    await shot(name, { full: true });
  }

  await open("/");
  await shot("01-dashboard", { full: true });
  await evaluate(`[...document.querySelectorAll("nav[aria-label=Main] button")].find((b) => b.textContent.includes("Simulators"))?.click()`);
  await wait(400);
  await shot("13-navigation-menu");
  await shot("14-dashboard-mobile", { full: true, width: 390, height: 844 });

  await setTheme("dark");
  await open("/");
  await shot("15-dashboard-dark", { full: true });
} finally {
  ws.close();
  const exited = new Promise((resolve) => chrome.once("exit", resolve));
  chrome.kill();
  await exited;
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
