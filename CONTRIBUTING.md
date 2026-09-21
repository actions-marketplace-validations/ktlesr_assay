# Contributing

Thanks for looking. Assay is early, but both halves exist: the SDK runs end to
end on Claude Code, and the hosted layer is deployed at
[assayctl.dev](https://assayctl.dev). One host adapter is supported today.

## Getting set up

```
pnpm install
pnpm check     # typecheck + lint + tests
```

Node 22 (see `.nvmrc`) and pnpm 10.

Tests that touch a real host are **not** part of `pnpm test`; they cost money.
They live in `tools/` and are run by hand:

```
node tools/check-auth.mjs          # verify credentials work in isolation
node tools/live-adapter-probe.mjs  # three real runs against Claude Code
node tools/e2e-run.mjs             # the example suite, end to end
```

## The rules that are not negotiable

`docs/invariants.md` holds six of them. They are not style preferences; each
one is load-bearing for the product's claim to measure anything. A change that
breaks one will be rejected even if the code is good.

The two that catch people out:

- **Never return `pass` when a signal could not be read.** The assertion engine
  enforces this structurally: an evaluator is not called at all when its
  evidence is missing.
- **Never emit a bare rate.** `Proportion` carries `n` and the interval; there
  is no code path that produces a naked number.

## Architecture in one paragraph

`packages/core` is pure: no I/O, no Node built-ins, no other Assay package. It
holds the schema, the canonical run record, the assertion engine and scoring.
`packages/runner` collects evidence and hands it to core. `packages/adapters`
implements one host each. `packages/cli` is the face. These boundaries are
enforced by lint rules, and `tools/dependency-boundaries.test.ts` proves the
rules actually catch violations.

## Language

English: everything that faces outward. User-facing strings (validation
errors, CLI output, reports), the root `README.md`, the package READMEs, the
action README, this file, and commit messages.

Turkish: code comments and the working notes under `docs/`. They are the
maintainer's notebook, not product documentation. Links into them from
outward-facing pages are marked `(Turkish)` so nobody clicks in blind.

See `docs/decisions.md` (Turkish) for why the split exists.

## Before you push

`pnpm check` must be green, and a pre-commit hook scans staged content for
secrets. Do not disable it.

Commits follow Conventional Commits. Decisions taken under uncertainty go in
`docs/decisions.md` with their reasoning and reversal cost.
