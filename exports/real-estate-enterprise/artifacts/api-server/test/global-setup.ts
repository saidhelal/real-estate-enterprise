import { spawn, execSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const artifactDir = path.resolve(here, "..");

/** Ask the OS for a currently-free TCP port. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/healthz`);
      if (res.ok) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`API server did not become healthy in ${timeoutMs}ms: ${String(lastErr)}`);
}

let child: ChildProcess | undefined;

export async function setup(): Promise<void> {
  if (!process.env["DATABASE_URL"]) {
    throw new Error("DATABASE_URL is required to run the API e2e tests.");
  }
  if (!process.env["SESSION_SECRET"]) {
    throw new Error("SESSION_SECRET is required to run the API e2e tests.");
  }

  // Build the server exactly as production runs it (esbuild bundle → dist/index.mjs).
  execSync("node ./build.mjs", { cwd: artifactDir, stdio: "inherit" });

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  child = spawn("node", ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: artifactDir,
    env: { ...process.env, PORT: String(port), NODE_ENV: "test" },
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    if (code && code !== 0) {
      // Surface a crash so the suite fails loudly rather than hanging on fetch.
      console.error(`API server exited early (code=${code}, signal=${signal})`);
    }
  });

  await waitForHealth(baseUrl, 60_000);

  // Hand the base URL to the test files.
  process.env["E2E_BASE_URL"] = baseUrl;
}

export async function teardown(): Promise<void> {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child?.kill("SIGKILL");
      resolve();
    }, 5_000);
    child?.on("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
