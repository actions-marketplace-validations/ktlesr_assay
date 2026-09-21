import { Button } from '@ktlsr/assay-ui'
import Link from 'next/link'
import { auth, signOut } from '../../lib/auth'

/**
 * Başlıktaki oturum bölümü.
 *
 * Rol gizlenmiyor: yönetici olarak gezerken bunu görmek, yanlışlıkla yönetici
 * yetkisiyle iş yapmayı azaltıyor.
 */
export async function UserMenu() {
  const session = await auth()
  if (session === null) {
    return (
      <Link href="/signin" className="head-link">
        Sign in
      </Link>
    )
  }

  async function endSession() {
    'use server'
    await signOut({ redirectTo: '/' })
  }

  return (
    <span className="flex items-baseline gap-3">
      {session.user.role === 'ADMIN' ? (
        <Link
          href="/admin"
          className="text-xs uppercase tracking-[0.09em] text-text-muted no-underline hover:text-text"
        >
          Admin
        </Link>
      ) : null}
      <Link
        href="/settings/tokens"
        className="text-xs uppercase tracking-[0.09em] text-text-muted no-underline hover:text-text"
      >
        Tokens
      </Link>
      <span className="text-xs text-text-faint" title={session.user.email ?? ''}>
        {session.user.email}
        {session.user.role === 'ADMIN' ? (
          <span className="ml-2 uppercase tracking-[0.09em] text-text">admin</span>
        ) : null}
      </span>
      <form action={endSession}>
        <Button type="submit" tone="quiet">
          Sign out
        </Button>
      </form>
    </span>
  )
}
