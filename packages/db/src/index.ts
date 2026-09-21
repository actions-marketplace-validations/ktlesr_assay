/**
 * @ktlsr/assay-db — hosted katmanın veri modeli.
 *
 * Prisma şeması `prisma/schema.prisma`, migration'lar `prisma/migrations/`.
 * Bu paket kanonik `Run` tipini satırlara açar ve geri kurar; hosted taraf
 * kendi formatını dayatmaz.
 */

export {
  assertSuiteStorable,
  suiteWarnings,
  isNearNeighbour,
  SuiteNotStorableError,
  toSuiteRow,
  toCaseRow,
  toRunRow,
  toCaseResultRow,
  toAttemptRow,
  toTraceEventRow,
  toEnvDiffRow,
  fromRunRow,
  fromCaseResultRow,
  fromAttemptRow,
  fromTraceEventRow,
  type SuiteRow,
  type CaseRow,
  type RunRow,
  type CaseResultRow,
  type AttemptRow,
  type TraceEventRow,
  type EnvDiffRow,
} from './mapping.js'

export {
  prisma,
  PrismaClient,
  databaseUrl,
  isConfigured,
  DatabaseNotConfiguredError,
} from './client.js'

export {
  storeRun,
  listRuns,
  loadRun,
  RecordShapeError,
  RunAlreadyStoredError,
  type RunScope,
} from './store.js'
