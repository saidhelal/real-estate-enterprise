# Migration Report — Real Estate Enterprise → Windows

Date: 2026-08-03
Target path: `C:\Users\DELL\Replit-Recovery\real-estate-enterprise`

## Package

- Archive: `real-estate-enterprise.zip` (~186 MB)
- Contents: the complete project exactly as it exists, including:
  - All source code: `artifacts/` (api-server, erp, portal, mockup-sandbox), `lib/` (db schema, api-spec, generated clients, shared libs), `scripts/`
  - Full Git history (`.git/`)
  - Config: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig*.json`, `.replit`, `.gitignore`, `replit.md`
  - Docs, notes, and working files (`.agents/`, `.local/`, `attached_assets/`, `*.txt` analysis files)
- Excluded (regenerable, not project files): `node_modules/` (all packages), `.cache/`, `.upm/`, the export archive itself

## Verification

- Source files (excluding node_modules/cache): 48,088
- Zip integrity test: `unzip -t` → **No errors detected**; all 49,341 entries (files + directories) tested OK
- Nothing was run, built, installed, deployed, or pushed — copy only

## How to restore on Windows

1. Download `real-estate-enterprise.zip` from the card in the chat (it is also saved in the project's `exports/` folder).
2. Create `C:\Users\DELL\Replit-Recovery\real-estate-enterprise` and extract the zip's contents into it (right-click → Extract All, or `tar -xf` in PowerShell).
3. Recommended: enable Windows long paths (`git config --system core.longpaths true` and the LongPathsEnabled registry key) — the generated-client folders have deep paths.

## To run later on Windows (for reference only — not done now)

- Node.js v24.x, pnpm 10.x, PostgreSQL 16
- `pnpm install` at the repo root
- Env vars required: `DATABASE_URL`, `SESSION_SECRET` (secrets are NOT included in the archive — set them locally)
- Object storage / AI-integration env vars are Replit-managed and will need Windows-local replacements if those features are used
- Seed: `pnpm --filter @workspace/api-server run seed` (super admin: `superadmin` / `Admin@123456`)
- Dev servers: `pnpm --filter @workspace/api-server run dev`, `pnpm --filter @workspace/erp run dev` (each needs a `PORT` env var; on Replit these were injected by workflows)

## Notes / caveats

- Environment secrets (`DATABASE_URL`, `SESSION_SECRET`, object-storage and AI keys) live in Replit's secret store and are intentionally NOT in the archive.
- The database data itself is not in the archive — only the schema code and seed script. If you need the data, request a database dump separately.
- `.replit` and `artifact.toml` files are Replit-specific; they are included for completeness but have no effect on Windows.
