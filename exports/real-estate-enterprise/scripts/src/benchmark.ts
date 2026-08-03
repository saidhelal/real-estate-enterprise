/**
 * Performance benchmark for the ERP API. Hits a set of representative endpoints
 * through the shared proxy, measures latency percentiles, and prints a table
 * plus a final pass/fail against simple latency budgets. Read-only: it logs in
 * as the seeded super admin and only issues GETs.
 *
 * Usage: pnpm --filter @workspace/scripts run benchmark
 *   BENCH_BASE   (default http://localhost:80/api)
 *   BENCH_USER   (default superadmin)
 *   BENCH_PASS   (default Admin@123456)
 *   BENCH_N      (iterations per endpoint, default 30)
 */

const BASE = process.env.BENCH_BASE ?? "http://localhost:80/api";
const USER = process.env.BENCH_USER ?? "superadmin";
const PASS = process.env.BENCH_PASS ?? "Admin@123456";
const N = Number(process.env.BENCH_N ?? "30");

interface Target {
  name: string;
  path: string;
  budgetMs: number;
}

const TARGETS: Target[] = [
  { name: "liveness", path: "/livez", budgetMs: 50 },
  { name: "readiness", path: "/readyz", budgetMs: 250 },
  { name: "companies", path: "/companies", budgetMs: 400 },
  { name: "users", path: "/users", budgetMs: 500 },
  { name: "leads", path: "/leads?pageSize=50", budgetMs: 600 },
  { name: "dashboard", path: "/dashboard/summary", budgetMs: 800 },
];

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("Login returned no session cookie");
  return cookie
    .split(/,(?=[^;]+=[^;]+)/)
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function measure(
  target: Target,
  cookie: string,
): Promise<{ name: string; ok: number; fail: number; avg: number; p50: number; p95: number; max: number; budgetMs: number }> {
  const times: number[] = [];
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < N; i++) {
    const start = performance.now();
    try {
      const res = await fetch(`${BASE}${target.path}`, { headers: { cookie } });
      const dur = performance.now() - start;
      times.push(dur);
      if (res.ok) ok += 1;
      else fail += 1;
      await res.arrayBuffer();
    } catch {
      fail += 1;
    }
  }
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / (times.length || 1);
  return {
    name: target.name,
    ok,
    fail,
    avg: Math.round(avg),
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    max: Math.round(Math.max(0, ...times)),
    budgetMs: target.budgetMs,
  };
}

async function main(): Promise<void> {
  console.log(`Benchmark: ${BASE} (${N} iterations/endpoint)\n`);
  const cookie = await login();

  const rows = [];
  for (const target of TARGETS) {
    rows.push(await measure(target, cookie));
  }

  const header = ["endpoint", "ok", "fail", "avg", "p50", "p95", "max", "budget", "result"];
  console.log(header.map((h) => h.padEnd(12)).join(""));
  console.log("-".repeat(header.length * 12));

  let allPass = true;
  for (const r of rows) {
    const pass = r.fail === 0 && r.p95 <= r.budgetMs;
    if (!pass) allPass = false;
    console.log(
      [
        r.name,
        String(r.ok),
        String(r.fail),
        `${r.avg}ms`,
        `${r.p50}ms`,
        `${r.p95}ms`,
        `${r.max}ms`,
        `${r.budgetMs}ms`,
        pass ? "PASS" : "FAIL",
      ]
        .map((c) => c.padEnd(12))
        .join(""),
    );
  }

  console.log(`\nOverall: ${allPass ? "PASS" : "FAIL"}`);
  process.exitCode = allPass ? 0 : 1;
}

main().catch((err) => {
  console.error("Benchmark error:", err);
  process.exitCode = 1;
});
