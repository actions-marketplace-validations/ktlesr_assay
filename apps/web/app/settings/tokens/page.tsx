import { prisma } from '@ktlsr/assay-db'
import { headers } from 'next/headers'
import { Button, EmptyState } from '@ktlsr/assay-ui'
import { Shell } from '../../components/shell'
import { requireUser } from '../../../lib/guard'
import { originFrom } from '../../../lib/origin'
import { revokeToken } from './actions'
import { TokenForm } from './token-form'

/**
 * API token'ları.
 *
 * Token bir kez gösterilir. Sonradan gösterilebilen bir token, veritabanında
 * okunabilir duruyor demektir; o zaman "yalnızca özeti saklanır" cümlesi doğru
 * olmazdı.
 */
export default async function TokensPage() {
  const session = await requireUser('/settings/tokens')
  const origin = originFrom(await headers())

  const tokens = await prisma().apiToken.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <Shell breadcrumbs={[{ label: 'settings' }, { label: 'tokens' }]}>
      <h1 className="page-title">API tokens</h1>
      <p className="page-lede">
        <code className="code">assay push</code> uploads a stored run with one of these.
        Only the hash is kept here, so a token can be revoked but never read back.
      </p>

      <div className="mt-10">
        <TokenForm />
      </div>

      <div className="mt-12">
        <p className="rule-label mb-4">Existing</p>
        {tokens.length === 0 ? (
          <EmptyState
            title="No tokens yet"
            description="Create one above, then set ASSAY_TOKEN in the environment where the CLI runs."
            action={
              <code className="font-mono text-xs text-text-faint">
                assay push --url {origin}
              </code>
            }
          />
        ) : (
          <ul className="ruled">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="flex flex-wrap items-baseline justify-between gap-4 py-3"
              >
                <span className="min-w-0">
                  <span className="font-mono text-sm">{token.name}</span>
                  <span className="ml-3 font-mono text-xs text-text-faint">
                    …{token.lastFour}
                  </span>
                  <span className="mt-1 block text-xs text-text-faint">
                    created {token.createdAt.toISOString().slice(0, 10)} ·{' '}
                    {token.lastUsedAt === null
                      ? 'never used'
                      : `last used ${token.lastUsedAt.toISOString().slice(0, 16).replace('T', ' ')}`}
                  </span>
                </span>
                {token.revokedAt === null ? (
                  <form action={revokeToken}>
                    <input type="hidden" name="id" value={token.id} />
                    <Button type="submit" tone="danger">
                      Revoke
                    </Button>
                  </form>
                ) : (
                  <span className="text-xs uppercase tracking-[0.09em] text-text-faint">
                    revoked
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  )
}
