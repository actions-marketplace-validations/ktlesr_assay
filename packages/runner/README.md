# @ktlsr/assay-runner

The execution layer of [Assay](https://github.com/ktlesr/assay), a CI test
runner for Agent Skills.

`core` decides what a result means. This package produces the material it
decides on: it runs a case set N times against a host adapter, captures what
happened, and writes a canonical run record to disk.

```
npm install @ktlsr/assay-runner
```

## What it does

**Runs a suite.** `runSuite` executes every case the configured number of
times, collects evidence per attempt, and returns a `Run` — the canonical
record type defined in `@ktlsr/assay-core`. The repeat count is never 1 by
default: a single attempt is an observation, not a measurement.

**Provides a workspace per attempt.** `createWorkspace` gives each attempt its
own temporary directory. `snapshot` and `envDiff` hash the file system before
and after so writes can be attributed, and `capture` reads back the artifacts
an assertion needs, within the limits in `CAPTURE_LIMITS`.

The workspace **observes; it does not enforce.** File system and network
boundaries rest on the host's own permission layer, and a process that opens
its own socket is not seen. Where the boundary cannot be observed the run
records that fact and the affected assertion becomes `unknown` — a shell
command, for instance, is not readable as a set of writes, so side-effect
claims around it are not scored. The ceiling is documented rather than papered
over; see [sandbox-security.md](https://github.com/ktlesr/assay/blob/main/docs/sandbox-security.md) (Turkish).

**Pins the run.** `pinsOf` and `suiteHash` record the four pins a later
comparison requires, including hashes computed from actual content rather than
declared version strings.

**Stores runs locally.** `RunStore` writes versioned JSON under `.assay/runs/`.
Records are human-readable and can be uploaded as a CI artifact directly. No
database and no hosted service is required for any of this.

## Writing an adapter

A host adapter implements `HostAdapter` from `@ktlsr/assay-core`. Every method
is `async`, so a synchronous throw still surfaces as a rejected promise and the
runner can handle failure in one place. See
[docs/adapters.md](https://github.com/ktlesr/assay/blob/main/docs/adapters.md) (Turkish).

`@ktlsr/assay-runner/testing` exports a `MockAdapter`. It is a test tool. It is
deliberately kept off the main entry point and a repository test fails if any
non-test source imports it, because fabricated results must never reach a
report.

## License

Apache-2.0. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
