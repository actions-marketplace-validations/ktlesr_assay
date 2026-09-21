import { describe, expect, it } from 'vitest'
import { containerLabel, diffEnvironments, type ContainerEnvironment, type Environment } from './records.js'

/**
 * Denemenin koştuğu konteyner (K2).
 *
 * Alan yoksa deneme ana makinede koştu. Konteyner koşumu ile dizüstü koşumu
 * karşılaştırıldığında fark adıyla söylenmeli; yoksa kullanıcı iki ölçümün neden
 * karşılaştırılmadığını bilemez ya da — hash'e girmeseydi — hiç fark etmezdi.
 */

const base: Environment = {
  model: 'm',
  version: '2.1.270',
  tools: [],
  skills: [],
  agents: [],
  plugins: [],
  memory: [],
}
const container: ContainerEnvironment = {
  image: 'sha256:630415ad',
  platform: 'linux/amd64',
  egress: ['cdn.playwright.dev', 'registry.npmjs.org'],
  limits: 'memory 2g, cpus 2, pids 512',
}

describe('diffEnvironments — container', () => {
  it('ana makine ile konteyneri ayırır ve ikisini de adıyla söyler', () => {
    expect(diffEnvironments(base, { ...base, container })).toEqual([
      {
        field: 'container',
        before: 'none (a process on the host)',
        after: 'sha256:630415ad linux/amd64; egress cdn.playwright.dev, registry.npmjs.org; memory 2g, cpus 2, pids 512',
      },
    ])
  })

  it('iki konteyner arasında kayan her alanı ayrı söyler', () => {
    const other = { ...container, image: 'sha256:bbbb', egress: ['registry.npmjs.org'] }
    expect(diffEnvironments({ ...base, container }, { ...base, container: other })).toEqual([
      { field: 'container', before: 'image sha256:630415ad', after: 'image sha256:bbbb' },
      {
        field: 'container',
        before: 'egress cdn.playwright.dev,registry.npmjs.org',
        after: 'egress registry.npmjs.org',
      },
    ])
  })

  it('aynı konteyner ve ana makine koşumları fark üretmez', () => {
    expect(diffEnvironments({ ...base, container }, { ...base, container: { ...container } })).toEqual([])
    expect(diffEnvironments(base, base)).toEqual([])
  })
})

describe('containerLabel', () => {
  it('ana makinede koşan kayıt bunu söyler, boş kalmaz', () => {
    expect(containerLabel({ environment: base })).toBe('none (a process on the host)')
    expect(containerLabel({})).toBe('none (a process on the host)')
  })

  it('konteyner koşumu imajı, platformu, çıkışı ve sınırları söyler', () => {
    expect(containerLabel({ environment: { ...base, container } })).toBe(
      'sha256:630415ad linux/amd64; egress cdn.playwright.dev, registry.npmjs.org; memory 2g, cpus 2, pids 512',
    )
  })
})
