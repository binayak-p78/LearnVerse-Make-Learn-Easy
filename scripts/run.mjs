import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND = join(ROOT, "backend");
const FRONTEND = join(ROOT, "frontend");
const WINDOWS = process.platform === "win32";
const PYTHON = join(BACKEND, ".venv", WINDOWS ? "Scripts" : "bin", WINDOWS ? "python.exe" : "python");
const NPM = WINDOWS ? "npm.cmd" : "npm";
const API_PORT = process.env.API_PORT ?? "8000";

// npm on Windows is a .cmd file, which Node only starts through a shell
const options = (cwd, env = {}) => ({ cwd, stdio: "inherit", shell: WINDOWS, env: { ...process.env, ...env } });

function run(command, args, cwd) {
  const { status, error } = spawnSync(command, args, options(cwd));
  if (error) fail(`Could not start ${command}: ${error.message}`);
  if (status !== 0) process.exit(status ?? 1);
}

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function requireBackend() {
  if (!existsSync(PYTHON)) fail("The Python environment is missing. Run `npm run setup` first.");
}

function requireFrontend() {
  if (!existsSync(join(FRONTEND, "node_modules"))) fail("Frontend packages are missing. Run `npm run setup` first.");
}

function setup() {
  const uv = spawnSync("uv", ["--version"], { shell: WINDOWS, encoding: "utf8" });
  if (uv.status !== 0) fail("uv is not installed. Get it from https://docs.astral.sh/uv/getting-started/installation/ and try again.");
  if (!existsSync(PYTHON)) run("uv", ["venv", ".venv", "--python", "3.14"], BACKEND);
  run("uv", ["pip", "install", "--python", PYTHON, "-r", "requirements.txt"], BACKEND);
  run(NPM, ["install"], FRONTEND);
  console.log("\n✔ Setup complete. Start the app with: npm run dev");
}

// Stops a child and everything it started (npm → vite on Windows runs under a shell)
function stop(child) {
  if (child.exitCode !== null || child.killed) return;
  if (WINDOWS) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

function dev() {
  requireBackend();
  requireFrontend();
  const children = [
    spawn(PYTHON, ["-m", "uvicorn", "app.main:app", "--reload", "--port", API_PORT], options(BACKEND)),
    spawn(NPM, ["run", "dev"], options(FRONTEND, { API_PORT })),
  ];
  console.log(`Backend on http://127.0.0.1:${API_PORT}. Open the "Local" address Vite prints below (usually http://localhost:5173). Ctrl+C stops both.`);
  let stopping = false;
  const shutdown = (code = 0) => {
    if (stopping) return;
    stopping = true;
    children.forEach(stop);
    process.exitCode = code;
  };
  for (const child of children) child.on("exit", (code) => shutdown(code ?? 0));
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
}

function test() {
  requireBackend();
  requireFrontend();
  run(PYTHON, ["-m", "pytest", "-q"], BACKEND);
  run(PYTHON, ["-m", "ruff", "check", "app", "tests"], BACKEND);
  run(NPM, ["test"], FRONTEND);
  run(NPM, ["run", "typecheck"], FRONTEND);
  console.log("\n✔ All checks passed.");
}

function build() {
  requireFrontend();
  run(NPM, ["run", "build"], FRONTEND);
  console.log("\n✔ Built frontend/dist. Serve everything from one process with: npm start");
}

function start() {
  requireBackend();
  if (!existsSync(join(FRONTEND, "dist"))) fail("No build found. Run `npm run build` first.");
  run(PYTHON, ["-m", "uvicorn", "app.main:app", "--host", process.env.HOST ?? "127.0.0.1", "--port", API_PORT], BACKEND);
}

const COMMANDS = { setup, dev, test, build, start };
const name = process.argv[2];
if (!(name in COMMANDS)) fail(`Unknown command "${name ?? ""}". Use one of: ${Object.keys(COMMANDS).join(", ")}.`);
COMMANDS[name]();
