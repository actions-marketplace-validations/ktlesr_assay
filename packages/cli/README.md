# assay

A CI test runner for Agent Skills.

A skill's README says what it does. Assay measures what it does: whether it
fires on the right request, stays quiet on the wrong one, produces the artifact
it promised, and still does all of that tomorrow.

Works fully offline of any hosted service. Runs are stored locally under
`.assay/runs/`.

## Install

```
npm install -g @ktlsr/assay
```

Requires Node 22 and a host CLI. The Claude Code adapter needs
`CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) or `ANTHROPIC_API_KEY`,
because each run happens in an isolated config directory that does not inherit
your interactive session.

## Use

```
assay init my-skill.suite.yaml          # write a template
assay validate my-skill.suite.yaml      # check it without spending anything
assay run my-skill.suite.yaml --skill ./my-skill
assay report                            # print the newest stored run
assay compare <run-a> <run-b>           # regression check, pins enforced
assay ci my-skill.suite.yaml --skill ./my-skill
```

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Everything measured passed |
| 1 | A case failed |
| 2 | Usage error: bad suite, missing file, unknown command |
| 3 | **Nothing could be measured.** Not a failure — an absence of measurement |

Code 3 exists because a test runner's worst failure is reporting "passed" for
something it could not measure. Use `--allow-unknown` to treat it as success in
CI once you have decided that is acceptable for your pipeline.

## What a case set looks like

```yaml
version: 1
target: { skill: docx, source: anthropics/skills@0f1c2d3 }
environment:
  host: claude-code
  model: claude-haiku-4-5-20251001
  system_prompt_hash: not-provided-by-host
runs: 10

cases:
  - id: trigger.positive.explicit
    prompt: Turn this draft into a Word document.
    expect: { triggered: true }

  - id: trigger.negative.near_neighbor.pdf
    prompt: Export this draft as a PDF.
    expect: { triggered: false }
```

A trigger suite **without a negative case is rejected**. A skill that fires on
every request passes every positive case and looks perfect; the near-neighbour
case — a request that resembles the skill's scope but sits outside it — is the
only thing that measures real discrimination.

Full format: [docs/suite-format.md](https://github.com/ktlesr/assay/blob/main/docs/suite-format.md) (Turkish).

## Four rules the output obeys

**Verdicts are three-valued.** `pass`, `fail`, `unknown`. A signal that could
not be read produces `unknown`, never a quiet `pass`.

**No rate is printed without N and a confidence interval.** `100% (N=3, 95% CI
44%–100%)` — three runs say as much as three runs say.

**The repeat count is never 1.** A single attempt is an observation, not a
measurement.

**Two runs are compared only when four pins match**: skill version and content
hash, model id, system prompt hash, and case set version and content hash. If
one drifted, `compare` refuses and names it — a score that fell because the
model changed is not a regression.

## Packages

`@ktlsr/assay` is the command line face of the SDK. It is built from three
libraries that can also be used directly:

| Package | Role |
|---|---|
| [`@ktlsr/assay-core`](https://www.npmjs.com/package/@ktlsr/assay-core) | Suite schema, assertion engine, scoring, run comparison. Pure, no I/O |
| [`@ktlsr/assay-runner`](https://www.npmjs.com/package/@ktlsr/assay-runner) | Sandboxed execution, workspace capture, local run store |
| [`@ktlsr/assay-adapters`](https://www.npmjs.com/package/@ktlsr/assay-adapters) | Host adapters. Claude Code today |

## License

Apache-2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
