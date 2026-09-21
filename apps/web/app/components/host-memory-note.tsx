import type { Run } from '@ktlsr/assay-core'
import { hostMemoryNote } from '../../lib/host-memory-note'

/**
 * Künyede, host CLAUDE.md sızıntısına maruz kalmış kaydın notu (0.4.5).
 *
 * Kayıt yeniden ölçülmedi; not bunu ve gerekçesini söylüyor. İz sayısı
 * kayıtlardan üretilmiş veriden (`lib/host-memory-exposure.json`) geliyor.
 * Bir ölçüm sonucu değil, kaydın kökeni hakkında bir not: renk yok.
 */
export function HostMemoryNote({ run }: { run: Run }) {
  const note = hostMemoryNote(run)
  if (note === null) return null
  return (
    <div className="mt-8 max-w-[62ch] space-y-3 border-t border-rule pt-6 text-sm text-text-muted">
      <p>
        <span className="text-text">
          Recorded before the host CLAUDE.md leak was closed (Assay 0.4.5).
        </span>{' '}
        This run&rsquo;s working directory sat under the measuring machine&rsquo;s home
        directory, and Claude Code loads instruction files from every directory above the
        one it works in, so that machine&rsquo;s <code className="font-mono">~/.claude/CLAUDE.md</code>{' '}
        &mdash; a single instruction about an unrelated tool,{' '}
        <span className="font-mono">{note.marker}</span> &mdash; would have entered the
        context. Which instruction files actually entered it was not measured.
      </p>
      <p>
        The name <span className="font-mono">{note.marker}</span> appears in{' '}
        {note.traces === 0
          ? `none of this run’s ${note.attempts} attempts.`
          : `${note.traces} of this run’s ${note.attempts} attempts.`}{' '}
        No trace does not prove no effect.
      </p>
      <p>
        Not re-measured: no Skill call in any published run targets{' '}
        <span className="font-mono">{note.marker}</span>, and the one finding the file could
        plausibly affect &mdash; the marketing-skills positioning case, 10 of 10 attempts
        &mdash; was reproduced without it, 8 of 10.
      </p>
    </div>
  )
}
