-- 0.3.0-e — dar bir ölçüm, dar olduğunu söyler.
--
-- Hızlı mod (`--fast`) yalnızca tetiklenme katmanını ölçüyor. O koşumun kaydı,
-- kendi başına okunduğunda da bunu söylemek zorunda; yoksa artefakt
-- iddialarının sınandığı sanılır.
--
-- `layers` boş dizi = hepsi ölçüldü (0.3.0-e öncesi her koşum böyle).
ALTER TABLE "Run" ADD COLUMN "layers" TEXT[] NOT NULL DEFAULT '{}';

-- Hiç koşulmamış vakalar, sebepleriyle: [{ caseId, reason }].
--
-- Bunlar `CaseResult` içinde sıfır denemeli satırlar olarak durmuyor. "Vaka
-- koşulmadı" ile "vaka koşuldu ama hiçbir deneme karar vermedi" iki farklı
-- şey; N=0'lık bir satır ikincisi gibi okunur ve okuyucu ölçülmemiş bir vakayı
-- ölçülmüş sanardı.
ALTER TABLE "Run" ADD COLUMN "skipped" JSONB;

-- Atlanan vaka sebepsiz olamaz. Eksiği bildirip sebebini bildirmemek,
-- okuyucuyu bilgisiz bırakırken bilgilendirilmiş sanmaktır — `unknown`ın
-- gerekçe zorunluluğuyla aynı kural.
-- JSON path ile, alt sorgu olmadan: Postgres CHECK içinde alt sorguya izin
-- vermiyor ("cannot use subquery in check constraint") ve ilk yazım tam olarak
-- bunu deniyordu — migration'ı gerçekten uygulayan test yakaladı.
ALTER TABLE "Run"
  ADD CONSTRAINT "run_skipped_shape"
  CHECK (
    "skipped" IS NULL
    OR (
      jsonb_typeof("skipped") = 'array'
      AND NOT jsonb_path_exists(
        "skipped",
        '$[*] ? (!exists(@.caseId) || !exists(@.reason) || @.reason == "")'
      )
    )
  );
