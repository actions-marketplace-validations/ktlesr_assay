/**
 * @ktlsr/assay-runner — sandbox koşumu, adaptör arayüzü, kayıt katmanı, yerel store.
 *
 * Sahte adaptör bilerek buradan dışa verilmez; `@ktlsr/assay-runner/testing` altında.
 * Veri gerçekliği sözleşmesi gereği yalnızca test aracıdır.
 */

export type { HostAdapter, AgentSession, RunConfig, SessionResult } from './adapter.js'

export {
  runSuite,
  suiteHash,
  pinsOf,
  type RunOptions,
  type ProgressEvent,
} from './run.js'

export {
  createWorkspace,
  workRoots,
  destroyWorkspace,
  snapshot,
  directoryHash,
  capture,
  captureFiles,
  CAPTURE_LIMITS,
  envDiff,
  type Workspace,
  type Snapshot,
} from './sandbox.js'

export {
  RunStore,
  parseStored,
  STORE_VERSION,
  type StoredRun,
  type StoreOptions,
} from './store.js'

export { assembleRun, verdictOf } from './assemble.js'
export { localNames } from './identity.js'
export { ASSAY_VERSION } from './version.js'

export { killTree, killChildTree, type KillTreeResult } from './process.js'
export {
  superviseAttempt,
  workerEntry,
  type SupervisorOptions,
  type SupervisedAttempt,
} from './supervisor.js'
export type { AdapterSpec, WorkerPayload } from './worker.js'

export {
  RunJournal,
  readJournal,
  findJournals,
  recoverJournal,
  JOURNAL_VERSION,
  JOURNAL_SUFFIX,
  type JournalHeader,
  type JournalAttempt,
  type JournalContents,
  type RecoveredRun,
} from './journal.js'
