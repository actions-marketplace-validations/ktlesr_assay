-- 0.2.0 — Aktivasyon doğrulaması, izin modu ve hook olayları.
--
-- Üç ekleme, üçü de aynı sebeple: ölçümün koşulunu kayıtta saklamak.
--   1. `triggerRefused` / `triggerRefusals` — seçilmiş ama aktive olmamış bir
--      skill ne tetiklenmedir ne tetiklenmemedir.
--   2. `Run.permissionMode` — araçları kısıtlanmış bir skill ile
--      kısıtlanmamış olan aynı skill değil.
--   3. `HOOK` iz olayı ve `TraceEvent.refusal` — hook'lar ve izin reddi
--      skill'in davranışını değiştiriyor ve hiçbiri skill'in kendisi değil.

-- Yeni iz olayı türü. Postgres enum değeri eklemeyi geri almaz; bu yüzden
-- ayrı bir migration olarak duruyor.
ALTER TYPE "TraceEventKind" ADD VALUE IF NOT EXISTS 'HOOK';

ALTER TABLE "TraceEvent" ADD COLUMN "refusal" TEXT;
ALTER TABLE "TraceEvent" ADD COLUMN "hook" JSONB;

ALTER TABLE "Attempt" ADD COLUMN "triggerRefused" BOOLEAN;
ALTER TABLE "Attempt" ADD COLUMN "triggerRefusals" JSONB NOT NULL DEFAULT '[]';

-- 0.2.0 ÖNCESİ SATIRLAR.
--
-- O koşumlarda red hiç ölçülmedi: adaptör `Skill` çağrısını görüp tetiklenme
-- yazıyordu ve `tool_result`a bakmıyordu. Yani `false` burada "red gözlenmedi"
-- demek, "red yoktu" demek değil.
--
-- Yine de `false` yazılıyor, çünkü yerel dosya store'daki aynı kayıtlar da
-- çalışma zamanında böyle davranıyor (alan yok → falsy) ve iki kalıcılık
-- hedefinin ayrışmaması şart. Asıl koruma başka yerde: izin modu ortam
-- hash'ine girdiği için bu koşumlar 0.2.0 koşumlarıyla zaten
-- karşılaştırılamıyor ve `comparePins` "ortam kaydı" diyor.
UPDATE "Attempt" SET "triggerRefused" = false WHERE "triggerAvailable" = true;

ALTER TABLE "Run" ADD COLUMN "permissionMode" TEXT;

-- Pin 3'ün denetçisi yerel kayıtta vardı ama hosted tarafta hiç saklanmıyordu;
-- yüklenen her koşumda pin 3 "ölçülemedi" kalıyor ve karşılaştırma `unknown`
-- üretiyordu. İzin modu bu hash'in içinde olduğu için burada kapanıyor.
ALTER TABLE "Run" ADD COLUMN "pinEnvironmentHash" TEXT;

-- Sinyal okunduysa red durumu da bilinir; okunamadıysa bilinmez. Ayrıca
-- reddedilmiş bir aktivasyon tetiklenme SAYILAMAZ: ikisi aynı anda doğru
-- olamaz, yoksa "reddedildi ama tetiklendi" diyen bir kayıt yazılabilirdi.
ALTER TABLE "Attempt"
  ADD CONSTRAINT "attempt_refusal_shape"
  CHECK (
    ("triggerAvailable" = true
      AND "triggerRefused" IS NOT NULL
      AND NOT ("triggerRefused" = true AND "triggerTriggered" = true))
    OR
    ("triggerAvailable" = false
      AND "triggerRefused" IS NULL
      AND "triggerRefusals" = '[]'::jsonb)
  );

-- `hook` yalnızca HOOK olaylarında, ve HOOK olayı hook'suz olamaz: aksi
-- hâlde kayıtta neyin koştuğu bilinmeyen bir hook satırı kalırdı.
--
-- Karşılaştırma `::text` üzerinden: Postgres, aynı işlem içinde eklenen bir
-- enum değerinin enum sabiti olarak kullanılmasına izin vermiyor ("unsafe use
-- of new value of enum type") ve migration tek bir işlemde koşuyor. Metne
-- çevirmek yeni değeri hiç enum sabiti hâline getirmiyor.
ALTER TABLE "TraceEvent"
  ADD CONSTRAINT "traceevent_hook_shape"
  CHECK (
    ("kind"::text = 'HOOK' AND "hook" IS NOT NULL)
    OR
    ("kind"::text <> 'HOOK' AND "hook" IS NULL)
  );
