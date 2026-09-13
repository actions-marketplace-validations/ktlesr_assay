# @ktlsr/assay-adapters

## 0.4.4

### Patch Changes

- 4e6269f: `compare` now names only what stopped the comparison. When a pin changed and
  another pin could not be read, the reason used to list both in one sentence
  ("suiteHash changed; systemPromptHash could not be read"), so it was unclear
  which one blocked. The reason now carries the change; the unreadable pin moves
  to `RunComparison.note` and prints on its own `also:` line. An unreadable pin
  with no change beside it is still the reason, and still stops the comparison.
- Updated dependencies [4e6269f]
  - @ktlsr/assay-core@0.4.4

## 0.4.3

### Patch Changes

- f728b9f: `--fast` no longer skips a case whose only claim is an expected winner.
  
  Fast mode measures the trigger layer and skips cases that only declare
  assertions. Its test for "has a trigger claim" predates `expect.winner`
  (0.4.0), so a case carrying nothing but `winner:` — a contested case,
  `winner: [copywriting, copy-editing]` — was skipped and recorded as "the case
  only declares assertions", which was false. Found on a real collision run:
  one of twenty cases went unmeasured. Such cases now run and are judged by
  the winner rule.
- Updated dependencies [f728b9f]
  - @ktlsr/assay-core@0.4.3

## 0.4.2

### Patch Changes

- 22c1f72: `assay push` tells a failed upload apart from a mistyped command, and says
  when the run it just uploaded is not visible to anyone else yet.
  
  - **Exit code 4** when the upload did not happen: the server could not be
    reached or refused the record. It used to be 2, the usage-error code, which
    sent CI users looking at their command line instead of at the server.
    **Behaviour change:** a pipeline that treated 2 from `push` as "the server
    said no" should now look for 4.
  - After a successful upload to a case set that has not been published yet,
    push prints that only you can open the link until an administrator
    publishes it. The hosted side now reports whether the case set is public.
  - `assay --version` prints the version, the same value a record carries as
    `assayVersion`.
- Updated dependencies [22c1f72]
  - @ktlsr/assay-core@0.4.2

## 0.4.1

### Patch Changes

- e2c39b5: Masking now catches the username in the three forms real records carried
  past `assay scrub`, and `push` checks a record before it leaves the machine.
  
  - A path whose backslashes a shell swallowed (`C:UsersadaAppData…`), the
    Claude Code project directory name (`C--Users-ada`) and a path escaped twice
    inside code the agent wrote (`C:\\Users\\ada`) are masked. On the eight
    records from the first real upload, 0.4.0 left the username in 71 places;
    this release leaves none, with or without knowing the name.
  - The account running Assay is also masked by name, wherever a path carries
    it, when a record is written, read, scrubbed or pushed. This closes the
    cases a pattern cannot see, such as a name with a dot.
  - `push` refuses to upload a record that still carries a secret, a home path
    or this account's name after masking, and names where. `--allow-unmasked`
    uploads anyway, once you have checked. When masking changed the uploaded
    copy, `push` says how many places and that the file on disk is unchanged.
- Updated dependencies [74fa395]
- Updated dependencies [e2c39b5]
  - @ktlsr/assay-core@0.4.1

## 0.4.0

### Minor Changes

- 7c81b0f: Collision suites: say which skill should win, and see who did.
  
  A suite has one `target.skill`, and until now a collision case, one aimed at a
  different co-installed skill, could only list the skills that must *not*
  fire. A run where nothing fires satisfies that. Measured on a real
  200-attempt collision run: Assay reported 179 pass / 21 fail while 7 of 13
  skills never fired on their own cases, and 100 positive attempts in which no
  skill fired were scored as pass.
  
  - **`expect.winner`**: `winner: <skill>` means that skill should be the first
    confirmed activation; `winner: [a, b]` passes if either is first (a contested
    case); `winner: none` means no active skill should fire, and counts as a
    negative for the "every trigger suite needs a negative case" rule.
  - **Nothing fired is a fail, not unknown.** The signal was read and the
    expected skill did not fire; that is a measurement. A different skill firing
    first is also a fail, and the reason names who won. Unknown is kept for runs
    where the result genuinely cannot be known.
  - **Collision matrix** in the terminal and HTML reports: expected winner ×
    first skill to fire, with each row's win rate given with N and a 95%
    interval. It sits above the trigger accuracy, which is now labelled
    "target only".
  - **Case ids accept hyphens** (`collide.copy-editing.tighten`), and an invalid
    id says which character is the problem.
  - A case that only lists `not_triggered` gets a warning that it also passes
    when no skill fires.
  
  Existing suites keep working unchanged apart from that warning. Re-scored with
  the new schema, the real run above becomes 79 pass / 121 fail, and its matrix
  matches the hand-built analysis cell for cell.

### Patch Changes

- Updated dependencies [7c81b0f]
  - @ktlsr/assay-core@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [07cc12a]
  - @ktlsr/assay-core@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [3570a5f]
  - @ktlsr/assay-core@0.3.1

## 0.3.0

### Minor Changes

- d21e4e7: Comparison now names the field that actually moved. When two runs differ in
  their environment, `compare` reported "systemPromptHash changed" — a field
  that reads `not-provided-by-host` in both records and therefore never moved.
  The auditor's finding was filed under the audited pin's name.
  
  `comparePins` now reports `environmentHash`, and the run record carries the
  environment behind that hash (model, version, output style, permission mode,
  tool/skill/agent/plugin lists) so the reason can say
  `permissionMode: acceptEdits → bypassPermissions` instead of only "something
  changed". Records written before this release have no environment components;
  those comparisons fall back to hash level and say so.
  
  No verdict changes: the same comparisons are refused as before, with the
  right reason.
- 98651e0: Each attempt now runs in its own process, so an attempt that gets killed costs
  an attempt instead of the run.
  
  The agent being measured verifies its work by starting dev servers and then
  killing processes by port. The runner is an ordinary node process on the same
  machine, and during a 240-attempt measurement it was killed twice that way.
  Part of that was our own doing: the adapter killed only its direct child, so
  the servers the agent started outlived the attempt and the next agent found the
  port busy.
  
  `assay run` now supervises each attempt in a short-lived worker and closes that
  worker together with its process tree when the attempt ends. A killed attempt
  is recorded as `unknown` — not `fail`, because nothing was measured — with a
  reason that names what happened. `--no-isolation` runs attempts in the calling
  process as before; library callers that pass their own adapter instance keep
  the in-process default.
  
  Measured, with real processes and a real killer: in-process, one kill ends the
  run and records nothing; isolated, the same kills cost two attempts out of four
  and the run finishes. No orphan servers were left behind in either arm.
  
  This is a limit, not a shield. The supervising process is a node process too,
  and killing it still stops the run — the journal then holds the completed
  attempts and `assay recover` turns them into a record. Real isolation needs a
  container and stays in Phase 3.
- b3c7e12: A killed run no longer loses the attempts it already measured.
  
  Until now the record was written once, after every case finished, so a process
  killed mid-run took every completed attempt with it. That is not theoretical:
  during a 240-attempt measurement the runner was killed twice by the agent it
  was measuring, and ~40 minutes and ~$4 of attempts went with it.
  
  Each attempt is now appended to `.assay/runs/<run-id>.partial.jsonl` as it
  completes. A run that finishes normally folds the journal into the usual record
  and deletes it. A run that dies leaves the journal on disk, and the new `assay
  recover` turns it into a record — one that says it is incomplete, carrying the
  reason, the recovery time, and the count of any journal lines too damaged to
  read. `assay run` warns when it finds a journal from an earlier run.
  
  The loss is now capped at one attempt. The runner is still killable; making it
  survive is a separate change.
- bae696c: `--concurrency <n>` runs attempts in parallel. The default stays 1.
  
  A 240-attempt measurement took eight hours because attempts ran one at a time.
  They can now share the machine, but speeding up is a choice rather than a
  default: parallel attempts compete for CPU, memory, ports and the host's rate
  limit, and a default that quietly changed the conditions of a measurement would
  be the wrong kind of help.
  
  The value is written to the run record and deliberately kept out of the
  environment hash. The hash records the environment the host reported; how many
  attempts ran at once is a property of the run, not of the host, and folding it
  in would make runs at different speeds incomparable on trigger accuracy too.
  What it does affect is latency and cost, so the report says so whenever
  concurrency is above one.
  
  Each worker gets a disjoint port range, passed to the agent as `PORT`,
  `VITE_PORT` and `ASSAY_PORT_RANGE`. This is a mitigation, not a guarantee: an
  agent is free to ignore them, and a server with a hardcoded port will still
  collide with its neighbour.
  
  Records written before this release have no concurrency field, which means one.

### Patch Changes

- Updated dependencies [d21e4e7]
- Updated dependencies [98651e0]
- Updated dependencies [b3c7e12]
- Updated dependencies [bae696c]
- Updated dependencies [468da43]
  - @ktlsr/assay-core@0.3.0

## 0.2.0

### Minor Changes

- f8b2d63: Trigger accuracy now measures **activation**, not the `Skill` call.
  
  **BREAKING BEHAVIOUR CHANGE — refused activations are no longer counted as
  triggers, and this changes the numbers of runs you have already recorded.**
  
  Until 0.2.0 a `Skill` tool call was reported as a trigger the moment it
  appeared in the stream. Whether the host actually loaded the skill was never
  checked. In a pilot run, four recorded triggers turned out to be four refused
  activations — nothing had run — and the report still said `precision 100%`.
  
  A `Skill` call now counts as a trigger only when its matching `tool_result`
  came back without an error and carried the skill body. A call that was denied,
  failed, returned an empty body, or never produced a result is a **refusal**:
  neither `pass` nor `fail`, but `unknown`, in every layer that reads it.
  
  What changes for you:
  
  - Positive cases whose activation was refused move from `fail` to `unknown`.
    They were never a skill defect; the permission layer stopped them.
  - Negative cases whose activation was refused move from `pass` to `unknown`.
    This is the more dangerous direction that was being hidden: the model *did*
    reach for the skill and the report said it did not trigger.
  - `precision`, `recall` and the discrimination note drop those attempts from
    the denominator instead of counting them as observations, so a run whose
    activations were all refused now reports "not measurable" instead of 100%.
  - CI exit codes shift accordingly: affected runs move from `1` to `3`
    ("nothing could be measured"). Use `--allow-unknown` if that must not fail
    the pipeline while you fix the permission mode.
  
  Also in this release:
  
  - `--permission-mode` is now settable on `assay run` and `assay ci`. The
    default is unchanged (`acceptEdits`); it was hardcoded before, and a skill
    that declares `allowed-tools` cannot activate under that mode at all. The
    mode the host reports is written to the run record, shown in the terminal
    and HTML report, and folded into the environment hash — a skill measured
    with restricted tools and the same skill measured without them are two
    different measurements. Because the hash definition changed, runs recorded
    before 0.2.0 compare against newer runs as environment-drifted and produce
    `unknown` rather than a false verdict. `bypassPermissions` additionally
    requires `--allow-bypass-permissions`.
  - `result.permission_denials` is read. The host had been reporting denied tool
    calls all along; the parser ignored them. Denied calls now carry a
    `refusal` on the trace event, so "the skill could not do it" and "Assay did
    not allow it" stop looking the same.
  - `system/hook_started` and `system/hook_response` are parsed into the trace
    as `hook` events with name, event, phase, exit code, outcome, stdout and
    stderr. Hooks change what the agent sees and can block its tool calls; a
    run record that omits them cannot explain the difference between two runs.

### Patch Changes

- Updated dependencies [f8b2d63]
  - @ktlsr/assay-core@0.2.0

## 0.1.3

### Patch Changes

- A run that never happened now reports `unknown` on every layer, not `fail`.
  
  **BEHAVIOUR CHANGE — read this before upgrading.** Runs that report `fail`
  today will report `unknown` after this release, and the CI exit code moves
  from **1** to **3**. If your pipeline treats those codes differently — and it
  should — this changes which branch you take. `assay ci --allow-unknown` turns
  exit 3 back into 0 if you want the old pass-through behaviour.
  
  **What was wrong.** When the host could not open a session at all — a revoked
  token, a process that failed to start, a session whose `terminal_reason` was
  not `completed` — the same event produced three different verdicts in one
  attempt:
  
  | Layer | Before | After |
  |---|---|---|
  | Trigger | `unknown` | `unknown` |
  | `file_exists`, `file_valid`, `json_schema`, `file_content_matches` | **`fail`** | `unknown` |
  | `side_effect` | **`pass`** | `unknown` |
  
  Nothing was measured, yet one layer called it a failure and another called it
  a success. The `fail` sends you looking for a broken skill when the problem is
  a credential. The `pass` is worse: it is the silent pass the three-state
  verdict exists to prevent, and nobody investigates a green result.
  
  **Why it happened.** The trigger layer consulted the session's outcome; the
  assertion layer did not. With no session, the sandbox working directory stayed
  untouched, so evidence collection returned an *empty* file list rather than no
  file list at all. The dispatch guard only checks whether an evidence field is
  `undefined`, and an empty array is not undefined — so the assertions ran
  against a workspace that was never used. The same applied to the environment
  diff, where "no writes recorded" read as "the boundary held".
  
  **The fix.** When the session fails its cross-check, the runner now collects no
  evidence at all rather than empty evidence. No new mechanism was added: the
  existing guard already returns `unknown` for a missing evidence field, it was
  simply never shown the truth. The trace is still recorded in the run record for
  diagnosis; it is just not offered to assertions as evidence.
  
  **What did not change.** An agent that genuinely ran, completed, and wrote
  nothing still reports `fail` on `file_exists`. That distinction is the point —
  there the measurement is real, and turning it into `unknown` would lose exactly
  what this tool exists to detect. Both directions are covered by tests.
- Updated dependencies
  - @ktlsr/assay-core@0.1.3

## 0.1.2

### Patch Changes

- Mask home-directory paths, add `assay scrub`, and stop counting an unread pin as held.
  
  **Home-directory paths are masked.** Run records carry absolute paths from the
  agent's tool calls, and those paths carry the operating system username.
  Records are uploaded as CI artifacts, printed into the HTML report and can be
  published to a hosted instance — so a skill author sharing a run was sharing
  their machine's username. `C:\Users\ada\...` now becomes
  `C:\Users\<user>\...`; macOS and Linux home directories are covered too, and
  generic accounts like `runner` and `root` are left alone because they are not
  identities. The path shape survives, so the trace stays readable as a
  measurement; only the identity is removed.
  
  Masking runs at three points, not one: when a record is written, when it is
  read back, and when the HTML report escapes a value. Write-time alone would
  only protect records created after this release.
  
  **New: `assay scrub [dir]`.** Rewrites stored records in place through the
  same masking. A record store is a set of files, not a display surface — CI
  uploads it, people zip it and attach it to bug reports. The bytes need to be
  clean when they leave the machine, not when they are rendered. The GitHub
  Action runs this before uploading its artifact.
  
  **`comparePins` now reports a third state.** A pin whose value is a
  placeholder (`not-provided-by-host`, or empty) is no longer counted as *held*.
  Two runs both carrying the same placeholder were being treated as measured
  under identical conditions, which handed the comparison a guarantee nobody had
  made. Such a pin is now reported as `unavailable`, and a comparison resting on
  one returns `unknown`.
  
  To keep comparison working on hosts that do not publish a system prompt hash,
  `Pins` gained an optional `environmentHash`: the adapter already derived it
  from the host's reported environment but the runner never stored it. When both
  runs carry an equal environment hash, pin 3 counts as covered and the
  comparison proceeds.
  
  Note for existing users: runs recorded before this release have no environment
  hash, so comparing two of them now returns `unknown` rather than a verdict.
  That is the truthful answer — for those runs it genuinely is not known whether
  the host environment held.
- Updated dependencies
  - @ktlsr/assay-core@0.1.2

## 0.1.1

### Patch Changes

- 33a4c2b: Report when no negative case broke, and stop `init` crashing on a directory
  
  Both defects were found by running the published 0.1.0 against real skills
  from `anthropics/skills` (see `docs/measurements.md`).
  
  **`assay init` now rejects a directory instead of throwing.** The help text
  described the argument as a path next to a skill, but it is the suite *file*
  to write; passing a directory reached `writeFile` and surfaced an uncaught
  `EISDIR` with a Node stack trace, while every other usage error returns exit 2
  with one line. `init` now checks first and prints
  `error <path> is a directory; pass the suite file to write, ...`. The usage
  line reads `assay init [file]  write an example suite file`.
  
  **Reports now flag a trigger suite whose negatives never broke.**
  `RunSummary` carries a new `discrimination` field — `cases`, `attempts`,
  `falsePositives`, `untested` — and the terminal and HTML reports print a
  **no negative case broke** note with the negative case and attempt counts
  behind it.
  
  This matters because a clean sheet has two causes that look identical: the
  skill discriminates, or the case set never tested it. Measuring one skill
  twice with the same model and the same pins produced 100% and 51% trigger
  precision; the entire difference was how the negatives were built. The note
  says which reading a green result supports.
  
  It is a note, not a verdict: it never changes `verdict` or the exit code, it
  appears on failing runs whose negatives all held, and it disappears as soon as
  one negative leaks. Attempts whose trigger signal was unreadable are excluded
  — an unmeasured negative cannot show discrimination either way.
- Updated dependencies [33a4c2b]
  - @ktlsr/assay-core@0.1.1

## 0.1.0

First published release.

The Claude Code adapter. Each attempt runs in an isolated `CLAUDE_CONFIG_DIR` with an allowlisted environment, and the host's own success report is cross-checked before a session counts as complete.

Part of [Assay](https://github.com/ktlesr/assay), a CI test runner for Agent
Skills. The four packages share a version number: they are components of one
SDK and are only tested together.
