---
'@ktlsr/assay': patch
'@ktlsr/assay-core': patch
'@ktlsr/assay-runner': patch
'@ktlsr/assay-adapters': patch
---

Attempts can now run in containers: `assay run --container <image> --container-api <name:port>`.

Each attempt gets its own container on an internal Docker network. The only way
out is an egress proxy that the runner starts from the same image; it admits the
npm registry and Playwright's CDNs on 443 and nothing else. The Anthropic API is
reached through a credential proxy container you name with `--container-api`;
the attempt container only ever sees a placeholder key, never your credentials.
Assay's own code is mounted from the machine that runs the CLI, so the container
never measures with an older Assay than the one you are running. The image is in
`tools/runner-env` (Node 22.20, Claude Code 2.1.270, Playwright's Chromium, uid
1000, a build step that fails on any instruction file).

The image digest, platform, egress allowlist and limits are written to
`environment.container` and folded into the environment hash. Container runs
therefore do not compare with runs on your machine; `assay compare` names the
container as the changed condition. Runs without `--container` are unchanged and
keep comparing with earlier records.

Also:
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` now reaches the host session when
  you set it (it was dropped by the environment allowlist).
- A suite given by bare file name (`assay run x.suite.yaml`) now finds its
  fixtures; the fixture path used to be resolved against the file name itself
  and every attempt with fixtures came out `unknown`.
