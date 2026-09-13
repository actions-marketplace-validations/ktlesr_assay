---
'@ktlsr/assay': patch
'@ktlsr/assay-core': patch
'@ktlsr/assay-runner': patch
'@ktlsr/assay-adapters': patch
---

Your own `CLAUDE.md` no longer enters the measured context, and every run now
records which instruction files the host loaded.

A fresh `CLAUDE_CONFIG_DIR` was taken to isolate each run. It does not keep
instruction files out: Claude Code also reads `CLAUDE.md`, `.claude/CLAUDE.md`,
`.claude/rules/` and `CLAUDE.local.md` in every directory above the working
directory, and on Windows the temp directory sits under the home directory. Up
to 0.4.4 every Windows run loaded `~/.claude/CLAUDE.md`.

- The working directory is opened outside the home directory: on Windows under
  `<drive>:\assay-work` when `%TEMP%` is inside the home, on POSIX under `/tmp`.
  `ASSAY_WORK_ROOT` chooses it.
- Instruction files in every directory above the working directory are excluded
  (`claudeMdExcludes`). The working directory's own `CLAUDE.md` is the suite's
  fixture and still loads.
- What the host actually loaded is measured through its `InstructionsLoaded`
  hook and recorded as `environment.memory`: absent means not measured, `[]`
  means measured and clean. Every report shows it as "host memory"; the terminal
  prints a file loaded from outside the working directory in yellow.

Behaviour change: `memory` is part of the environment hash, so a 0.4.5 run does
not compare with a run recorded by 0.4.4 or earlier (`memory: not measured →
none loaded`). What entered the context of those runs was never measured.
