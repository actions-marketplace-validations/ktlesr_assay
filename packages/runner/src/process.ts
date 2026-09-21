/**
 * Süreç ağacı kapatma.
 *
 * Neden gerekiyor: adaptör zaman aşımında yalnızca doğrudan çocuğu
 * öldürüyordu. Ölçülen ajanın başlattığı dev sunucular hayatta kalıyor, yani
 * **portu meşgul eden yetimleri Assay üretiyordu**. Bir sonraki denemenin
 * ajanı portu dolu buluyor ve porta göre öldürmeye girişiyor; o sırada aynı
 * makinedeki runner da bir `node` süreci (docs/blockers.md, 4.2.2 ölçümü).
 *
 * "Kapatıldı" demek "öldüğü doğrulandı" demek değil: her iki platformda da en
 * iyi çaba, ve sonuç `ok` alanında dürüstçe bildiriliyor. Tavan
 * `docs/sandbox-security.md`'de yazılı.
 */

import { execFile } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { join } from 'node:path'

export interface KillTreeResult {
  /** Ağacın gerçekten boşaldığına dair en iyi bilgi: kök süreç artık yok. */
  ok: boolean
  /** Başarısızsa sebebi — kayda ve rapora girsin diye. */
  reason?: string
}

/**
 * Bir sürecin ve altındaki her şeyin ölmesini ister.
 *
 * Çağrı, kök süreç **hâlâ yaşarken** yapılmalı: ölmüş bir sürecin ağacını
 * yürümek PID yeniden kullanımına açık. Sevk katmanı tam olarak bunu yapıyor —
 * worker sonucu yazdıktan sonra kendi kendine çıkmıyor, canlı bekliyor ve
 * ağacıyla birlikte kapatılıyor.
 */
export async function killTree(pid: number): Promise<KillTreeResult> {
  if (!Number.isInteger(pid) || pid <= 0) {
    return { ok: false, reason: `refusing to kill an implausible pid ${String(pid)}` }
  }
  return process.platform === 'win32' ? killWindowsTree(pid) : killPosixGroup(pid)
}

/** Çocuğun ağacını kapatır; pid yoksa sessizce geçer. */
export async function killChildTree(child: ChildProcess): Promise<KillTreeResult> {
  const pid = child.pid
  if (pid === undefined) return { ok: false, reason: 'the child never reported a pid' }
  return killTree(pid)
}

/**
 * Windows: ağaç PPID üzerinden özyinelemeli yürünüyor.
 *
 * `taskkill /T` yetmiyor ve bu **ölçüldü**: `detached` başlatılmış bir torun —
 * kabuktan ayrılmış bir dev sunucu tam olarak böyle — `/T` ile ölmüyor.
 * Testin ilk hâli yanlış sebeple yeşildi: detached OLMAYAN bir çocuk zaten
 * Node'un (libuv'un) job object'i sayesinde ebeveyniyle birlikte ölüyor, yani
 * ölçülen şey bizim çabamız değildi. Yetim `detached` yapılınca `/T` kaldı.
 *
 * Windows PPID alanını ebeveyn öldükten sonra da koruduğu için torunlar yine
 * bulunabiliyor. Bedeli deneme başına bir süreç açılışı; ölçüm koşumları
 * dakikalarca sürdüğü için görünmüyor.
 */
async function killWindowsTree(pid: number): Promise<KillTreeResult> {
  const script = [
    "$ErrorActionPreference='SilentlyContinue';",
    'function KillBranch($id){',
    '  Get-CimInstance Win32_Process -Filter "ParentProcessId=$id" |',
    '    ForEach-Object { KillBranch $_.ProcessId };',
    '  Stop-Process -Id $id -Force;',
    '}',
    `KillBranch ${pid}`,
  ].join(' ')

  return new Promise((resolve) => {
    execFile(
      powershellPath(),
      ['-NoProfile', '-NonInteractive', '-Command', script],
      (error, _out, stderr) => {
        // Hata metnine bakılmıyor: mesajlar yerelleştirilmiş (bu makinede
        // Türkçe) ve "not found" araması sessizce hep başarısız derdi. Tek
        // dilden bağımsız soru şu: kök süreç hâlâ orada mı.
        if (!alive(pid)) return resolve({ ok: true })
        resolve({
          ok: false,
          reason: stderr.trim() || error?.message || 'the process is still alive',
        })
      },
    )
  })
}

/**
 * POSIX: ağaç PPID üzerinden yürünüyor, sonra her düğüme ve grubuna sinyal.
 *
 * Yalnızca köke grup sinyali (`kill(-pid)`) yetmiyor ve bu CI'da **ölçüldü**:
 * `detached: true` POSIX'te `setsid` demek, yani öyle başlatılan bir torun
 * kendi grubunu kuruyor ve kökün grubundan kaçıyor. Kabuktan ayrılmış bir dev
 * sunucu tam olarak böyle. Windows yolu PPID yürüdüğü için bunu hiç yaşamadı;
 * test yalnızca Linux runner'ında kırmızıya döndü.
 *
 * Önce bütün ağacın fotoğrafı çekiliyor, sonra öldürülüyor: yukarıdan aşağı
 * öldürürken çocuklar init'e evlat verilir ve PPID zinciri kopar.
 *
 * ponytail: tavan — kök çağrıdan ÖNCE ölmüş bir ara süreç varsa altındakiler
 * zaten init'e geçmiştir ve yürüyüşte görünmez; ancak bir grubun üyesiyse
 * ölür. Kesin cevap Linux'ta PR_SET_CHILD_SUBREAPER (native eklenti) ya da
 * konteyner — ikisi de Faz 3.
 */
async function killPosixGroup(pid: number): Promise<KillTreeResult> {
  const tree = [pid, ...(await posixDescendants(pid))]
  for (const member of tree) {
    // Grup sinyali: `setsid` ile kendi grubunu kuran düğüm grubunun lideri,
    // yani `-member` onun altındaki her şeyi de alıyor. Lider değilse ESRCH.
    signal(-member)
    signal(member)
  }
  // Kök SIGKILL'den sonra ebeveyni onu toplayana kadar zombi kalır ve sinyal 0
  // ona hâlâ "yaşıyor" der; o yüzden burada `alive` sorulmuyor.
  return { ok: true }
}

function signal(target: number): void {
  try {
    process.kill(target, 'SIGKILL')
  } catch {
    // ESRCH: zaten yok. EPERM: bizim değil — dokunmamak doğru olan.
  }
}

/**
 * Kökün bütün torunları, `ps` çıktısından.
 *
 * `ps` yoksa (procps'suz ince bir konteyner) boş liste dönüyor ve yalnızca grup
 * sinyali kalıyor — eski davranış, daha kötüsü değil.
 */
function posixDescendants(root: number): Promise<number[]> {
  return new Promise((resolve) => {
    execFile('ps', ['-A', '-o', 'pid=,ppid='], (error, stdout) => {
      if (error) return resolve([])
      const children = new Map<number, number[]>()
      for (const line of stdout.split('\n')) {
        const [pid, ppid] = line.trim().split(/\s+/).map(Number)
        if (pid === undefined || ppid === undefined || Number.isNaN(pid)) continue
        children.set(ppid, [...(children.get(ppid) ?? []), pid])
      }
      const found: number[] = []
      const queue = [root]
      while (queue.length > 0) {
        for (const child of children.get(queue.shift() as number) ?? []) {
          if (found.includes(child)) continue
          found.push(child)
          queue.push(child)
        }
      }
      resolve(found)
    })
  })
}

/** Süreç hâlâ yaşıyor mu. Sinyal 0 hiçbir şey göndermez, yalnızca sorar. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (cause) {
    return (cause as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * PowerShell'in tam yolu.
 *
 * PATH'e güvenilmiyor: bu ölçüm makinesinde `C:\Windows\System32` kabuk
 * PATH'inde değil ve aynı eksiklik 4.2.2 ölçümünde ölçülen skill'in
 * `where curl.exe` sondasını da düşürmüştü. PATH'e güvenen bir kapatma çağrısı
 * sessizce hiçbir şey kapatmaz — ve sessizce kapatmamak, kapattığını
 * sanmaktan beter.
 */
function powershellPath(): string {
  const root = process.env['SystemRoot'] ?? process.env['windir'] ?? 'C:\\Windows'
  return join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
}
