---
name: Architect git-diff false positives from regenerated codegen
description: Why the code-review architect may wrongly flag "scope violation" touching unrelated modules, and how to verify.
---

When `includeGitDiff: true` is passed to the architect/code-review subagent on a contract-first repo, the diff includes regenerated codegen outputs (e.g. `lib/api-client-react/src/generated/api.ts`, `api.schemas.ts`, zod, `openapi.yaml`). These single files contain ALL modules' definitions, so a diff that only *appends* one module's entries still shows surrounding lines from unrelated modules (accounting, etc.) as context.

**Symptom:** architect returns FAIL "scope violation — modified accounting/posting/money" even though you never touched those source files.

**Why:** the architect reads diff hunks, and large generated files put unrelated definitions adjacent to your additions; it mistakes context for changes.

**How to apply:** before accepting a scope-violation finding, verify against `git --no-optional-locks status --porcelain` (which lists actually-changed files), not the diff body. If no source files for the "violated" area appear in status, the finding is a false positive — the functional review of your actual changes still stands.
