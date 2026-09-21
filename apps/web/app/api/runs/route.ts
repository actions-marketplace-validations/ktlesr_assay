import { parseSuite, type Run } from '@ktlsr/assay-core'
import {
  RecordShapeError,
  RunAlreadyStoredError,
  SuiteNotStorableError,
  isConfigured,
  prisma,
  storeRun,
} from '@ktlsr/assay-db'
import { rateLimit } from '../../../lib/rate-limit'
import { identify } from '../../../lib/tokens'

/**
 * Koşum yükleme — `assay push` bu uca yazar.
 *
 * Platform ölçmez, hatırlar: burada hiçbir şey yeniden değerlendirilmiyor.
 * Gelen kayıt olduğu gibi saklanıyor; vaka seti yalnızca *ayrıştırılabilir*
 * olduğu için doğrulanıyor (negatif vaka zorunluluğu dahil), yeniden
 * skorlanmıyor.
 */

export const runtime = 'nodejs'

/**
 * Gövde üst sınırı.
 *
 * 10 tekrarlı, izleri ve ortam farkıyla birlikte kaydedilen bir koşum bir kaç
 * yüz kilobayt. 8 MB, bilinen en büyük gerçek kaydın kırk katından fazlası ve
 * belleği doldurmaya yetmiyor. Sınırsız bir gövde, kimliği doğrulanmış tek bir
 * istemcinin süreci düşürmesine yeterdi.
 */
const MAX_BODY_BYTES = 8 * 1024 * 1024

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

export async function POST(request: Request): Promise<Response> {
  if (!isConfigured()) {
    return json({ error: 'this instance has no database configured' }, 503)
  }

  const identity = await identify(request)
  if (identity === null) {
    return json({ error: 'a valid API token is required' }, 401)
  }
  if (!rateLimit(`push:${identity.userId}`, 60, 60_000)) {
    return json({ error: 'too many uploads, try again in a minute' }, 429)
  }

  const declared = Number(request.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return json({ error: 'the run record is too large to store' }, 413)
  }

  let body: { suite?: unknown; suiteSource?: unknown; run?: unknown }
  try {
    const raw = await request.text()
    // Beyan edilen uzunluğa güvenilmez; asıl kontrol okunan gövdede.
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: 'the run record is too large to store' }, 413)
    }
    body = JSON.parse(raw) as typeof body
  } catch {
    return json({ error: 'the request body is not valid JSON' }, 400)
  }

  if (typeof body.suiteSource !== 'string' || typeof body.run !== 'object' || body.run === null) {
    return json({ error: 'send { suiteSource: string, run: Run }' }, 400)
  }

  const parsed = parseSuite(body.suiteSource)
  if (!parsed.ok) {
    return json({ error: 'the case set is not valid', issues: parsed.issues }, 400)
  }

  const run = body.run as Run
  if (typeof run.id !== 'string' || run.id === '' || !Array.isArray(run.cases)) {
    return json({ error: 'the run record is not shaped like a run' }, 400)
  }

  try {
    const stored = await storeRun(prisma(), {
      suite: parsed.suite,
      suiteHash: run.pins.suiteHash,
      run,
      ownerId: identity.userId,
    })
    // `public`: yeni bir vaka seti gizli başlar ve CLI bunu söyleyebilsin diye
    // gönderiliyor — yoksa bastığı bağlantı başkasına 404 verir (0.4.1-f).
    return json({ runId: stored.runId, public: stored.suitePublic }, 201)
  } catch (cause) {
    if (cause instanceof RunAlreadyStoredError) {
      return json({ error: cause.message, runId: run.id }, 409)
    }
    // Prisma'nın hata metni tablo ve sütun adlarını taşıyor; dışarıya yalnızca
    // bizim yazdığımız kural mesajları çıkar.
    const known =
      cause instanceof SuiteNotStorableError ||
      cause instanceof RecordShapeError ||
      (cause instanceof Error && expected(cause))
    if (!known) console.error('run ingest failed', cause)
    return json(
      {
        error: known && cause instanceof Error ? cause.message : 'the run could not be stored',
      },
      400,
    )
  }
}

/** Kullanıcıya gösterilmesi güvenli olan, bizim yazdığımız kural mesajları. */
function expected(error: Error): boolean {
  return error.message.includes('do not belong together')
}
