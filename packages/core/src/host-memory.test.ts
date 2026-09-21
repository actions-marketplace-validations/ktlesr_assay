import { describe, expect, it } from 'vitest'
import { diffEnvironments, hostMemoryLabel, memoryFromOutside, type Environment } from './records.js'

/**
 * Host'un yüklediği talimat dosyaları (0.4.5).
 *
 * Üç durum ayrı tutuluyor: ölçülmedi, ölçüldü ve boş, ölçüldü ve dolu.
 * Ölçülmemiş bir kayıt "temiz" okunursa, 0.4.5'e kadarki hatanın aynısı
 * — izolasyonun varsayılması — kayıtta yeniden üretilir.
 */

const base: Environment = {
  model: 'm',
  version: '2.1.270',
  tools: [],
  skills: [],
  agents: [],
  plugins: [],
}
const leak = 'Project C:\\Users\\<user>\\.claude\\CLAUDE.md sha256:0123456789abcdef'
const fixture = 'Project ./CLAUDE.md sha256:fedcba9876543210'

describe('hostMemoryLabel', () => {
  it('olculmemis kayit "none" demez', () => {
    expect(hostMemoryLabel({ environment: base })).toMatch(/^not measured/)
    expect(hostMemoryLabel({})).toMatch(/^not measured/)
  })

  it('olculmus ve bos kayit bunu soyler', () => {
    expect(hostMemoryLabel({ environment: { ...base, memory: [] } })).toBe('none loaded (measured)')
  })

  it('yuklenen dosyalari listeler', () => {
    expect(hostMemoryLabel({ environment: { ...base, memory: [leak] } })).toContain('CLAUDE.md')
  })
})

describe('memoryFromOutside', () => {
  it('calisma dizini icindeki fixture sizinti sayilmaz, disaridaki sayilir', () => {
    expect(memoryFromOutside({ environment: { ...base, memory: [fixture, leak] } })).toEqual([leak])
  })

  it('olculmemis kayitta sizinti uydurulmaz', () => {
    expect(memoryFromOutside({ environment: base })).toEqual([])
  })
})

describe('diffEnvironments — memory', () => {
  it('olculmemis ile olculmus ayrisir ve adiyla soylenir', () => {
    expect(diffEnvironments(base, { ...base, memory: [] })).toEqual([
      { field: 'memory', before: 'not measured', after: 'none loaded' },
    ])
  })

  it('sizan dosya eklenen olarak yazilir', () => {
    const changes = diffEnvironments({ ...base, memory: [] }, { ...base, memory: [leak] })
    expect(changes).toEqual([{ field: 'memory', before: 'none loaded', after: `+${leak}` }])
  })

  it('ikisi de olculmemisse fark yok — 0.4.5 oncesi kayitlar birbiriyle konusur', () => {
    expect(diffEnvironments(base, base)).toEqual([])
  })
})
