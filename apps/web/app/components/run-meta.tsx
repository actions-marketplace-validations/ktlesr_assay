import {
  ACTIVATION_UNVERIFIED,
  activationUnverified,
  assayVersionLabel,
  hostMemoryLabel,
  type Run,
} from '@ktlsr/assay-core'

/**
 * Sertifikanın künyesi: dört pin ve iki denetçisi.
 *
 * Pinler gizlenmiyor. İki koşumun karşılaştırılabilir olması bunlara bağlı;
 * kullanıcı hangi koşulda ölçüldüğünü görmeden sonuca güvenemez.
 *
 * `drifted` verildiğinde kayan satırlar işaretlenir — karşılaştırma ekranında
 * "hangisi değişti" sorusunun cevabı listede duruyor, ayrı bir yerde değil.
 */
export function Pins({ run, drifted = [] }: { run: Run; drifted?: readonly string[] }) {
  /**
   * `driftKey` satırın hangi pinden sorumlu olduğunu söyler.
   *
   * 0.3.0-a'ya kadar ortam hash'i ve izin modu satırları `systemPromptHash`
   * anahtarını taşıyordu, çünkü `comparePins` denetçinin bulgusunu denetlenen
   * pinin adına yazıyordu. Artık kayan alan kendi adıyla geliyor ve satırlar
   * da kendi anahtarlarını kullanıyor. İzin modu hâlâ ortam hash'ine bağlı:
   * mod değişirse hash değişir, o yüzden o satır `environmentHash` ile
   * işaretleniyor.
   */
  const rows: ReadonlyArray<{
    key: string
    driftKey: string
    label: string
    value: string
  }> = [
    { key: 'skillSource', driftKey: 'skillSource', label: 'Skill version', value: run.pins.skillSource },
    {
      key: 'skillHash',
      driftKey: 'skillHash',
      label: 'Skill hash',
      value: run.pins.skillHash === '' ? 'not computed' : run.pins.skillHash,
    },
    { key: 'model', driftKey: 'model', label: 'Model', value: run.pins.model },
    // Pin 3 ve denetçisi ayrı satırlarda: türetilmiş bir hash'i sistem promptu
    // hash'i diye etiketlemek, kullanıcıya sahip olmadığı bir garanti satmak.
    {
      key: 'systemPromptHash',
      driftKey: 'systemPromptHash',
      label: 'System prompt hash',
      value: run.pins.systemPromptHash,
    },
    {
      key: 'environmentHash',
      driftKey: 'environmentHash',
      label: 'Environment hash',
      value: run.pins.environmentHash ?? 'not reported by the host',
    },
    {
      key: 'permissionMode',
      driftKey: 'environmentHash',
      label: 'Permission mode',
      value: run.permissionMode ?? 'not reported by the host',
    },
    // Host'un yüklediği talimat dosyaları, ölçülmüş hâliyle (0.4.5). Ortam
    // hash'inin içinde; ölçülmemiş bir kayıt "none" demez.
    { key: 'memory', driftKey: 'environmentHash', label: 'Host memory', value: hostMemoryLabel(run) },
    { key: 'suiteVersion', driftKey: 'suiteVersion', label: 'Case set version', value: String(run.pins.suiteVersion) },
    { key: 'suiteHash', driftKey: 'suiteHash', label: 'Case set hash', value: run.pins.suiteHash },
    // Pin değil ama yargının koşulu: kaydı hangi Assay sürümü üretti (0.3.2).
    { key: 'assayVersion', driftKey: 'assayVersion', label: 'Assay version', value: assayVersionLabel(run) },
    // Yalnızca 0.2.0 öncesi kayıtta: tetiklenme sayıları doğrulanmamış
    // aktivasyonlardan geliyor ve bu künyede görünmeli (0.4.1-a).
    ...(activationUnverified(run)
      ? [{ key: 'activation', driftKey: 'activation', label: 'Activation check', value: ACTIVATION_UNVERIFIED }]
      : []),
  ]
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
      {rows.map(({ key, driftKey, label, value }) => {
        const moved = drifted.includes(driftKey)
        return (
          <div key={key} className={`contents${moved ? ' pin-row-drifted' : ''}`}>
            <dt className="col-label py-0.5">
              {label}
              {moved ? <span className="pin-drift-mark">changed</span> : null}
            </dt>
            <dd
              className="min-w-0 truncate py-0.5 font-mono text-xs text-text-muted"
              title={value}
            >
              {value}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
