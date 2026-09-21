-- 0.4.0 — çakışma ölçümü: vaka kimliği ve beklenen kazanan.
--
-- Kanıt: marketingskills çakışma koşumu (200 deneme). Çakışma vakası yalnızca
-- `not_triggered` ile yazılabildi; hiçbir skill tetiklenmediğinde de geçti ve
-- 100 pozitif deneme `pass` sayıldı. Skill adları da id'ye yazılamadı: desen
-- tireyi reddediyordu.

-- 1. Vaka kimliği: core ile AYNI desen (packages/core/src/suite.ts, CASE_ID).
--    Yalnız core'da genişletilseydi tireli bir id doğrulayıcıdan geçip
--    `assay push`'ta burada reddedilirdi — aynı sorun bir katman aşağıda.
--    Eski desenin tam üst kümesi.
ALTER TABLE "Case" DROP CONSTRAINT "case_id_hierarchical";
ALTER TABLE "Case"
  ADD CONSTRAINT "case_id_hierarchical"
  CHECK ("caseId" ~ '^[a-z0-9][a-z0-9_-]*(\.[a-z0-9_][a-z0-9_-]*)+$');

-- 2. Beklenen kazanan — hem vaka tanımında hem vaka sonucunda (kayıt kendi
--    kendine yetsin; `expectTriggered` ile aynı gerekçe).
--
--    İki sütun, tek değil: "iddia yok" ile "`winner: none`" (boş liste) iki
--    ayrı şey, ve Prisma dizi sütunlarını NULL olabilir yapamıyor. Bayrak
--    iddianın varlığını, dizi içeriğini taşıyor.
ALTER TABLE "Case" ADD COLUMN "expectsWinner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Case" ADD COLUMN "expectedWinner" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "CaseResult" ADD COLUMN "expectsWinner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CaseResult" ADD COLUMN "expectedWinner" TEXT[] NOT NULL DEFAULT '{}';

-- İddia yoksa liste boş olmalı; dolu bir liste bayraksız dururken hangi
-- anlamda okunacağı belirsiz kalırdı.
ALTER TABLE "Case"
  ADD CONSTRAINT "case_winner_consistent"
  CHECK ("expectsWinner" OR cardinality("expectedWinner") = 0);
ALTER TABLE "CaseResult"
  ADD CONSTRAINT "case_result_winner_consistent"
  CHECK ("expectsWinner" OR cardinality("expectedWinner") = 0);

-- 3. Vaka bir şey ölçmeli — kazanan iddiası da bir ölçüm. Güncellenmeseydi
--    yalnız `winner` taşıyan bir vaka (ör. `winner: none`) burada reddedilir ve
--    bir çakışma suite'i hosted tarafa hiç yüklenemezdi.
ALTER TABLE "Case" DROP CONSTRAINT "case_measures_something";
ALTER TABLE "Case"
  ADD CONSTRAINT "case_measures_something"
  CHECK (
    "expectTriggered" IS NOT NULL
    OR coalesce(array_length("notTriggered", 1), 0) > 0
    OR coalesce(jsonb_array_length("assertions"), 0) > 0
    OR "expectsWinner"
  );
