'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  IconCall,
  IconEnd,
  IconHook,
  IconMessage,
  IconResult,
  IconSkill,
  IconSort,
} from './icons'
import { Badge, type VerdictKind } from './measurement'

/**
 * Yoğun veri bileşenleri: tablo ve iz görüntüleyici.
 *
 * İkisinin de ortak kuralı: sayılar tabular, sınırlar hairline, satırlar
 * kutuda değil çizgide. Hata dönen adımlar renkle *ve* işaretle ayrışır.
 */

// ---------------------------------------------------------------------------
// Tablo
// ---------------------------------------------------------------------------

export interface Column<Row> {
  key: string
  header: string
  /** Hücre içeriği. */
  render: (row: Row) => ReactNode
  /** Sıralama anahtarı. Verilmezse sütun sıralanamaz. */
  sortValue?: (row: Row) => string | number
  align?: 'left' | 'right'
  width?: string
}

/**
 * Sıralanabilir, yoğun tablo.
 *
 * Zebra şerit yok — cetvel çizgisi zaten satırı ayırıyor ve şerit, ölçüm
 * değerlerinin okunmasını zorlaştırıyor. Sıralama durumu `aria-sort` ile
 * bildiriliyor.
 */
export function Table<Row>({
  columns,
  rows,
  rowKey,
  empty,
}: {
  columns: readonly Column<Row>[]
  rows: readonly Row[]
  rowKey: (row: Row) => string
  empty?: ReactNode
}) {
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    null,
  )

  const sorted = useMemo(() => {
    if (sort === null) return rows
    const column = columns.find((c) => c.key === sort.key)
    if (column?.sortValue === undefined) return rows
    const get = column.sortValue
    return [...rows].sort((a, b) => {
      const left = get(a)
      const right = get(b)
      const order = left < right ? -1 : left > right ? 1 : 0
      return sort.direction === 'asc' ? order : -order
    })
  }, [rows, sort, columns])

  if (rows.length === 0 && empty !== undefined) return <>{empty}</>

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-rule">
          {columns.map((column) => {
            const sortable = column.sortValue !== undefined
            const active = sort?.key === column.key
            return (
              <th
                key={column.key}
                scope="col"
                style={column.width === undefined ? undefined : { width: column.width }}
                aria-sort={
                  active
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                className={`col-label py-2 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {sortable ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSort((current) =>
                        current?.key === column.key
                          ? {
                              key: column.key,
                              direction: current.direction === 'asc' ? 'desc' : 'asc',
                            }
                          : { key: column.key, direction: 'asc' },
                      )
                    }
                    className="inline-flex items-center gap-1 uppercase tracking-[0.09em] transition-colors hover:text-text"
                  >
                    {column.header}
                    <span className="text-text-faint">
                      <IconSort
                        size={12}
                        {...(active ? { direction: sort.direction } : {})}
                      />
                    </span>
                  </button>
                ) : (
                  column.header
                )}
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={rowKey(row)} className="border-b border-rule">
            {columns.map((column) => (
              <td
                key={column.key}
                className={`py-2 align-baseline text-sm ${
                  column.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {column.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---------------------------------------------------------------------------
// İz görüntüleyici
// ---------------------------------------------------------------------------

export interface TraceStep {
  seq: number
  kind:
    | 'tool_call'
    | 'tool_result'
    | 'assistant_message'
    | 'skill_trigger'
    | 'session_end'
    | 'hook'
  tool?: string | undefined
  skill?: string | undefined
  text?: string | undefined
  error?: string | undefined
  isError?: boolean | undefined
  outcome?: string | undefined
  args?: Record<string, unknown> | undefined
  /** İzin katmanı çağrıyı reddettiyse sebebi. Hata ile aynı şey değil. */
  refusal?: string | undefined
  /** `hook` adımında host'un çalıştırdığı kancanın adı. */
  hook?: string | undefined
}

const KIND_GLYPH: Record<TraceStep['kind'], typeof IconCall> = {
  tool_call: IconCall,
  tool_result: IconResult,
  assistant_message: IconMessage,
  skill_trigger: IconSkill,
  session_end: IconEnd,
  hook: IconHook,
}

/**
 * Araç çağrısı akışı.
 *
 * Hata dönen adımlar **iki** biçimde ayrışıyor: pas rengi ve sol kenardaki
 * kalın çizgi. Skill tetiklenmesi ayrı bir glifle işaretli, çünkü ölçümün
 * konusu o.
 *
 * `swallowed` verildiğinde akışın altında yutulan hata uyarısı gösterilir —
 * bu, ürünün ayırt edici ölçümü ve gizlenmemeli.
 */
export function TraceViewer({
  steps,
  swallowed,
}: {
  steps: readonly TraceStep[]
  swallowed?: { verdict: VerdictKind; reason: string }
}) {
  if (steps.length === 0) {
    return (
      <p className="note-empty">
        No trace was captured. An empty trace and a missing trace are different claims —
        this one is missing.
      </p>
    )
  }
  return (
    <div>
      <ol className="ruled font-mono text-xs">
        {steps.map((step) => (
          <li
            key={step.seq}
            className={`trace-step${step.isError === true ? ' trace-step-error' : ''}`}
          >
            <span className="trace-glyph">
              {(() => {
                const Glyph = KIND_GLYPH[step.kind]
                return <Glyph size={14} />
              })()}
            </span>
            <span
              className="truncate text-text-muted"
              title={step.tool ?? step.skill ?? step.hook ?? step.kind}
            >
              {step.tool ?? step.skill ?? step.hook ?? step.kind}
            </span>
            {/*
             * Red, hatanın önünde gösteriliyor: reddedilen bir çağrı da
             * `isError` taşıyor ama sebebi skill değil, izin katmanı. İkisi
             * aynı cümleyle anlatılırsa ölçüm yanlış okunur.
             */}
            <span className="min-w-0 break-words">
              {step.refusal !== undefined
                ? step.refusal
                : step.isError === true
                  ? (step.error ?? 'failed')
                  : (step.text ?? formatArgs(step.args) ?? step.outcome ?? '')}
            </span>
          </li>
        ))}
      </ol>
      {swallowed === undefined ? null : (
        <div className="note mt-6">
          <span className="note-mark">
            <Badge verdict={swallowed.verdict} showLabel={false} />
          </span>
          <div className="note-body">
            <p className="mark text-text-muted">did the agent report the failure?</p>
            <p className="note-text">{swallowed.reason}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function formatArgs(args: Record<string, unknown> | undefined): string | undefined {
  if (args === undefined) return undefined
  const text = JSON.stringify(args)
  return text.length > 160 ? `${text.slice(0, 160)}…` : text
}
