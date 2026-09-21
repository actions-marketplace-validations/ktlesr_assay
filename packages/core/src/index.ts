/**
 * @ktlsr/assay-core — şema tipleri, kanonik kayıt, assertion motoru, skorlama.
 *
 * Bu paket başka bir Assay paketine bağlanmaz ve I/O yapmaz: dosya sistemi,
 * ağ, süreç yok. Kural eslint.config.js içinde makine seviyesinde zorlanır.
 */

export {
  parseSuite,
  validateSuite,
  suiteSchema,
  expectedWinnerOf,
  isNegativeCase,
  WINNER_NONE,
  FILE_FORMATS,
  TRACE_RULES,
  type Suite,
  type SuiteCase,
  type Assertion,
  type SuiteIssue,
  type SuiteParseResult,
  type TraceRule,
  type FileFormat,
} from './suite.js'

export {
  assayVersionLabel,
  hostMemoryLabel,
  containerLabel,
  memoryFromOutside,
  activationUnverified,
  ACTIVATION_UNVERIFIED,
  PRE_VERSION_STAMP,
  comparePins,
  diffEnvironments,
  proportion,
  formatProportion,
  type Verdict,
  type VerdictDetail,
  type Pins,
  type PinComparison,
  type Environment,
  type ContainerEnvironment,
  type EnvironmentChange,
  type PartialRun,
  type RunLayer,
  type SkippedCase,
  type TraceEvent,
  type TraceEventKind,
  type SessionOutcome,
  type HookRecord,
  type TriggerObservation,
  type RefusedActivation,
  type NetworkRequest,
  type EnvDiff,
  type CapturedFile,
  type Evidence,
  type AssertionResult,
  type Cost,
  type Attempt,
  type CaseResult,
  type Run,
  type Proportion,
} from './records.js'

export {
  evaluateAssertion,
  evaluateAssertions,
  combineVerdicts,
  type AssertionContext,
} from './assertions.js'

export { evaluateNoSwallowedErrors } from './no-swallowed-errors.js'

export { evaluateTrigger, type TriggerExpectation } from './trigger.js'

export {
  countVerdicts,
  decidedRate,
  triggerAccuracy,
  flakiness,
  totals,
  summarize,
  summarizeRun,
  collisionMatrix,
  collisionPrefix,
  outsidePrefix,
  NO_SKILL,
  type CollisionMatrix,
  type CollisionRow,
  type VerdictCounts,
  type TriggerObservationPoint,
  type TriggerAccuracy,
  type Flakiness,
  type Totals,
  type RunSummary,
  type Discrimination,
} from './scoring.js'

export type { HostAdapter, AgentSession, RunConfig, SessionResult } from './adapter.js'

export {
  compareRuns,
  type ChangeStatus,
  type CaseComparison,
  type RunComparison,
} from './compare.js'

export {
  redact,
  redactDeep,
  containsSecret,
  containsHomePath,
  containsName,
  type RedactOptions,
} from './redact.js'

export { matchGlob, globToRegExp, normalizePath, isWithin } from './glob.js'
