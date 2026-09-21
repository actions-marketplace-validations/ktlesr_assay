-- 0.4.1-a — 0.2.0 öncesi kayıtta aktivasyon kontrolü yapılmadı.
--
-- 0.2.0'dan önce adaptör `Skill` çağrısını görüp tetiklenme yazıyordu ve
-- aktivasyonun gerçekleşip gerçekleşmediğine bakmıyordu; kayıtta `refused` ve
-- `refusals` alanları yok. 0.2.0 migration'ı bu satırlara `false` yazdı ve
-- gerekçesi "yerel store'da alan yok → falsy" idi. 0.4.1'de core yokluğu
-- "kontrol yapılmadı" diye okuyor (records.ts, `activationUnverified`), yani
-- hizalanma gereği şimdi NULL'u gösteriyor: `false` "red yok", NULL "kimse
-- bakmadı". Kısıt da bu yüzden 0.2.0 öncesi kayıtları reddediyordu ve o
-- kayıtlar hiç yüklenemiyordu (ilk gerçek `assay push`, 2026-09-10).
--
-- NULL yalnızca boş red listesiyle birlikte geçerli: red listesi dolu ama
-- durum bilinmiyor diyen bir satır tutarsız.
ALTER TABLE "Attempt" DROP CONSTRAINT "attempt_refusal_shape";
ALTER TABLE "Attempt"
  ADD CONSTRAINT "attempt_refusal_shape"
  CHECK (
    ("triggerAvailable" = true
      AND (("triggerRefused" IS NULL AND "triggerRefusals" = '[]'::jsonb)
        OR ("triggerRefused" IS NOT NULL
          AND NOT ("triggerRefused" = true AND "triggerTriggered" = true))))
    OR
    ("triggerAvailable" = false
      AND "triggerRefused" IS NULL
      AND "triggerRefusals" = '[]'::jsonb)
  );

-- 0.2.0 migration'ının `false` yazdığı satırlar. Ayırt edici işaret izin modu:
-- 0.2.0 kaydı `refused` ile `permissionMode`u birlikte getirdi; ölçüm
-- deposundaki 40 kayıtta ikisinin yokluğu birebir örtüşüyor.
UPDATE "Attempt" a
SET "triggerRefused" = NULL
FROM "CaseResult" c, "Run" r
WHERE a."caseResultId" = c."id"
  AND c."runId" = r."id"
  AND r."permissionMode" IS NULL
  AND a."triggerAvailable" = true
  AND a."triggerRefused" = false
  AND a."triggerRefusals" = '[]'::jsonb;
