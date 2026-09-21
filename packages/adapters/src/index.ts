/** @ktlsr/assay-adapters — host ortamı başına bir adaptör. */

export {
  ClaudeCodeAdapter,
  environmentHash,
  passthroughEnv,
  resolveBinary,
  skillMatches,
  isPermissionMode,
  PERMISSION_MODES,
  type PermissionMode,
  type ClaudeCodeSession,
  type ClaudeCodeAdapterOptions,
} from './claude-code/adapter.js'

export {
  parseSession,
  parseStreamJson,
  outcomeOf,
  type ParsedStream,
  type InitEvent,
  type ResultEvent,
  type PermissionDenial,
} from './claude-code/stream.js'
