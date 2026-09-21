# Assay

A CI test runner that measures whether an agent skill actually does what it
claims.

The name comes from metallurgy: an *assay* determines the real content of a
sample, not the claimed one. A skill's README says what it does. Assay
measures what it does.

## What it is not

Not a general-purpose LLM eval tool. Not a prompt comparison platform. Not a
model benchmark.

## What it is

A CI test runner for Agent Skills. What Jest is to unit tests and Playwright
is to browser flows, Assay is to skills: you write a case set, `assay run`
runs it, and you get a three-state verdict.

## Measurement layers

| Layer | Question |
|---|---|
| Trigger accuracy | Does the skill fire on the right request and stay quiet on the wrong one? |
| Task completion | Is the artifact correct once the work is done? |
| Tool-call trace | Were the expected tools called, in the expected order? |
| Side effects and safety | Did it touch anything it was not allowed to? |
| Instability | How much does the result vary across N runs of the same input? |
| Regression | Where did the new version of the skill get worse than the old one? |
| Cost and latency | Is it within the token and time budget? |

## Two parts

- **SDK (Apache-2.0)** — the side that measures. Fully functional without the
  platform. Runs locally and in CI.
- **Hosted platform** — the side that remembers. Run history, regression
  comparison, team visibility.

Using the SDK without the platform is a first-class scenario, not a degraded
one.

## Invariants

The six rules that hold up Assay's measurement claim live in
[docs/invariants.md](docs/invariants.md) (Turkish). In short:

- Verdicts are three-state: `pass` / `fail` / `unknown`. A silent `pass` is
  forbidden.
- A comparison needs four pins: skill version, model id, system prompt hash,
  case set version.
- The repeat count never defaults to 1.
- No rate is ever shown without its N and confidence interval.
- A trigger suite must contain negative and near-neighbour cases.
- No LLM judge in v0.

## Usage

```
npm install -g @ktlsr/assay

assay init my-skill.suite.yaml
assay validate my-skill.suite.yaml
assay run my-skill.suite.yaml --skill ./my-skill
assay compare <run-a> <run-b>
assay recover                              # after a run was killed mid-way
```

A run writes one journal line per attempt as it goes. If the process is killed
— which happens: an agent under test that kills processes by port can take the
runner with it — the attempts that finished are still on disk, and `assay
recover` turns them into a record that says it is incomplete.

To run from a checkout:

```
pnpm install && pnpm typecheck
node packages/cli/dist/bin.js validate my-skill.suite.yaml
```

The Claude Code adapter needs `CLAUDE_CODE_OAUTH_TOKEN` (produced by
`claude setup-token`) or `ANTHROPIC_API_KEY`: every run executes in an
isolated config directory, so it does not inherit your interactive session.

A fresh config directory does not keep your own `CLAUDE.md` out on its own:
Claude Code also reads instruction files in every directory above the working
directory, and on Windows the temp directory sits under your home. Up to 0.4.4
every Windows run loaded `~/.claude/CLAUDE.md` into the measured context. Since
0.4.5 the working directory is opened outside your home, instruction files above
it are excluded, and the files the host actually loaded are **measured and
recorded** (`environment.memory`, shown as "host memory" in every report).

CLI details: [packages/cli/README.md](packages/cli/README.md).

### GitHub Action

```yaml
- uses: actions/checkout@v5
- uses: ktlesr/assay@v1
  with:
    suite: ./my-skill.suite.yaml
    skill: ./my-skill
    claude-code-oauth-token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

The action installs the CLI and the host itself; no `setup-node` or build step
is needed. It writes the scorecard into a PR comment, fails the check on a
regression, and uploads the run records as an artifact (after passing them
through username and secret redaction).

Details: [action/README.md](action/README.md) · ready-made workflow
[examples/workflows/assay.yml](examples/workflows/assay.yml) · release steps
[docs/marketplace.md](docs/marketplace.md) (Turkish).

### npm packages

| Package | Role |
|---|---|
| [`@ktlsr/assay`](packages/cli) | CLI. `bin: assay` |
| [`@ktlsr/assay-core`](packages/core) | Schema, assertion engine, scoring, comparison. Pure, no I/O |
| [`@ktlsr/assay-runner`](packages/runner) | Sandboxed execution, evidence collection, local store |
| [`@ktlsr/assay-adapters`](packages/adapters) | Host adapters. Today, Claude Code |

`packages/db`, `packages/ui` and `apps/web` belong to the hosted layer and are
not published. Release process: [docs/releasing.md](docs/releasing.md)
(Turkish).

## Status

**Current release: 0.2.0** — four packages on npm, published from CI with
[SLSA provenance](https://slsa.dev/provenance/v1) and no stored token.

Phases 0 through 3 are complete: the SDK runs end to end on Claude Code, and
the hosted layer is built and deployed. Published measurements are readable at
[assayctl.dev](https://assayctl.dev) — run history, scorecards, per-attempt
traces, and comparisons that refuse to compare when a pin has moved.

### What 0.2.0 changed, and why

A pilot run exposed the sharpest failure this tool can have: **it reported a
measurement it had not made.** Four `Skill` calls were recorded as triggers.
None of them had activated — the host had refused every one — and the report
still said `precision 100%`.

A `Skill` call now counts as a trigger only when its matching result came back
without an error and carried the skill body. A refused activation is neither
`pass` nor `fail` but `unknown`, in every layer that reads it, and it is
dropped from the accuracy denominator instead of being counted as an
observation.

This is a behaviour change: runs that used to report `fail` or `pass` may now
report `unknown`, and the CI exit code moves from `1` to `3`. See the
[CLI changelog](packages/cli/CHANGELOG.md).

### What has been measured so far

Assay has been run against real, third-party skills rather than fixtures. The
two written-up measurement reports are:

- [docs/dogfooding.md](docs/dogfooding.md) (Turkish) — `docx`, `pdf` and
  `xlsx` from `anthropics/skills`. Found a real defect: a case described in a
  skill's own documentation fired in 4 of 10 attempts, because the model could
  do the work itself and never reached for the skill. Adding a fixture took it
  to 8 of 10 — and Assay refused to call that an improvement, because at N=10
  the two intervals (17–69% and 49–94%) overlap.
- [docs/measurements.md](docs/measurements.md) (Turkish) — `doc-coauthoring`,
  `mcp-builder` and `webapp-testing`. The most useful finding was about
  method, not about any skill: the same skill, the same model and the same
  pins produced 100% and 51% precision across two case sets. The entire
  difference came from how the negative cases were written.

Every number in those reports comes from a stored run record. Nothing on this
page is estimated.

Phase 0 feasibility result: on Claude Code all four signals are readable, and
a trigger appears as an explicit `Skill` tool call when the model selects it.
Codex publishes no structural trigger event, which is why the cross-host
matrix was deferred. Details:
[docs/host-feasibility.md](docs/host-feasibility.md) (Turkish) and
[docs/adapter-validation.md](docs/adapter-validation.md) (Turkish).

Roadmap: [docs/roadmap.md](docs/roadmap.md) (Turkish).

## Documentation

The working notes under `docs/` are written in Turkish. The code, the CLI
output, the schema errors and the reports are English.

- [docs/product.md](docs/product.md) — product definition, positioning, architecture
- [docs/invariants.md](docs/invariants.md) — the invariants and their rationale
- [docs/stack.md](docs/stack.md) — technology stack
- [docs/roadmap.md](docs/roadmap.md) — phases and exit criteria
- [docs/decisions.md](docs/decisions.md) — decision log
- [docs/suite-format.md](docs/suite-format.md) — case set YAML format and validation rules
- [docs/adapters.md](docs/adapters.md) — host adapter contract
- [docs/adapter-validation.md](docs/adapter-validation.md) — live validation of the Claude Code adapter
- [docs/measurements.md](docs/measurements.md) — measurement report on three third-party skills
- [docs/dogfooding.md](docs/dogfooding.md) — measurement report on three `anthropics/skills` skills
- [docs/sandbox-security.md](docs/sandbox-security.md) — sandbox security review and accepted risks
- [docs/releasing.md](docs/releasing.md) — npm release process and its checks
- [docs/operations.md](docs/operations.md) — token rotation, partial release, operations
- [docs/calibration.md](docs/calibration.md) — evidence that the tool can actually report red
- [docs/blockers.md](docs/blockers.md) — isolated blockers and their unblocking conditions
- [docs/design.md](docs/design.md) — design language: the assay certificate
- [docs/progress.md](docs/progress.md) — phase progress
- [docs/host-feasibility.md](docs/host-feasibility.md) — signal readability matrix for three hosts (phase 0 output)
- [docs/workflow.md](docs/workflow.md) — working contracts

## License

Apache-2.0. See [LICENSE](LICENSE).
