import { homedir } from 'node:os'
import { isAbsolute, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createWorkspace, destroyWorkspace, workRoots } from './sandbox.js'

/**
 * Çalışma dizini ev dizininin dışında açılır (0.4.5).
 *
 * Host çalışma dizininden köke kadar yürüyüp talimat dosyası arıyor. Windows'ta
 * `%TEMP%` ev dizininin altında; çalışma dizini orada açıldıkça kullanıcının
 * `~/.claude/CLAUDE.md`'si her denemeye giriyordu.
 */

const under = (path: string, root: string) => {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

describe('workRoots', () => {
  it('Windows: gecici dizin ev altindaysa surucu kokunde bir kok secer', () => {
    const roots = workRoots('C:\\Users\\ada\\AppData\\Local\\Temp', 'C:\\Users\\ada', undefined, 'win32')
    expect(roots[0]).toMatch(/^[A-Za-z]:[\\/]assay-work$/)
    expect(under(roots[0] as string, 'C:\\Users\\ada')).toBe(false)
  })

  it('POSIX: gecici dizin ev altindaysa /tmp', () => {
    expect(workRoots('/home/ada/.tmp', '/home/ada', undefined, 'linux')[0]).toBe('/tmp')
  })

  it('gecici dizin zaten ev disindaysa ona dokunulmaz', () => {
    expect(workRoots('/tmp', '/home/ada', undefined, 'linux')).toEqual(['/tmp'])
  })

  it('ASSAY_WORK_ROOT verildiyse o', () => {
    expect(workRoots('/home/ada/.tmp', '/home/ada', '/data/assay', 'linux')).toEqual([resolve('/data/assay')])
  })
})

describe('createWorkspace', () => {
  it('bu makinede calisma dizini ev dizininin altinda acilmaz', async () => {
    const workspace = await createWorkspace({})
    try {
      expect(under(workspace.dir, homedir())).toBe(false)
    } finally {
      await destroyWorkspace(workspace)
    }
  })
})
