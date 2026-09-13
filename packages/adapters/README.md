# @ktlsr/assay-adapters

Host adapters for [Assay](https://github.com/ktlesr/assay), a CI test runner
for Agent Skills.

An adapter is the part that knows one host CLI: how to start a session, and how
to read four signals back out of it — did the skill trigger, which tools were
called, did the session actually complete, and what did it cost.

```
npm install @ktlsr/assay-adapters
```

## Claude Code

`ClaudeCodeAdapter` is the adapter shipped today. It was chosen after a
feasibility study across three hosts because all four signals are observable
there without parsing prose: `system/init` reports the active skill set, a
`Skill` tool_use announces a trigger, `tool_result.is_error` carries the trace
signal, and the `result` message carries cost and latency.

```ts
import { ClaudeCodeAdapter } from '@ktlsr/assay-adapters'

const adapter = new ClaudeCodeAdapter()
```

Requires the `claude` CLI on `PATH`, plus `CLAUDE_CODE_OAUTH_TOKEN` (from
`claude setup-token`) or `ANTHROPIC_API_KEY`.

### Isolation

Every run gets its own temporary `CLAUDE_CONFIG_DIR` and the skill under test
is loaded into that session alone. Without this you measure the machine's
installation rather than the skill: in the experiment that produced this
decision, an unisolated probe had 119 skills active, the target skill never
fired on natural language, and the model reached for a neighbour's tool
instead. Isolated, the same probe saw 19.

The config directory alone does not keep instruction files out. Claude Code
reads `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/` and `CLAUDE.local.md` in
the working directory and in every directory above it, and on Windows the temp
directory is under the user's home — so up to 0.4.4 `~/.claude/CLAUDE.md` was in
every measured context. Since 0.4.5 the adapter writes `claudeMdExcludes` for
every directory above the working directory (the working directory's own
`CLAUDE.md` is the suite's fixture and stays), and the runner opens working
directories outside the home directory. It also **measures** what was loaded:
the host reports each file to an `InstructionsLoaded` hook, a `UserPromptSubmit`
canary proves the hook ran, and the result is recorded as `environment.memory`
— absent means not measured, `[]` means measured and clean. It is part of the
environment hash.

The child process does not inherit the parent environment. A short allowlist is
passed through — `PATH`, home and temp, locale and timezone, proxy settings —
plus the credential. Anything not on the list is absent, so a `GITHUB_TOKEN` in
CI is not visible to the skill being measured.

### The host is not taken at its word

`finalize` cross-checks the session before reporting completion. During the
feasibility spike Claude Code twice reported `subtype: "success"` for runs that
never happened — once "not logged in", once a revoked credential. The other
fields told the truth. So a session with zero cost and zero output tokens, zero
turns, or a terminal reason other than `completed` is marked `unknown` rather
than trusted.

`environmentHash` derives a stable hash from the `init` fields — model,
version, tool, skill, agent and plugin lists. It is reported as an
*environment* hash, not a system prompt hash, because the host does not expose
the system prompt and two different prompts could produce identical init
fields. It is a real drift detector that claims less than it could.

## License

Apache-2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
