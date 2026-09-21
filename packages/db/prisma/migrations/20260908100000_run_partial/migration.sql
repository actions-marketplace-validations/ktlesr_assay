-- 0.3.0-b — yarım kalmış koşum kayıtta yarım olduğunu söyler.
--
-- Ölçülen ajan runner'ı öldürebiliyor ve koşum ortasında ölen bir süreç o ana
-- kadar tamamlanmış her denemeyi de götürüyordu (docs/blockers.md). Journal
-- artık o denemeleri diskte tutuyor ve `assay recover` onları kayda çeviriyor.
--
-- Kurtarılan kayıt bir ölçümdür: vaka başına N doğru ve değişmez #4 gereği
-- aralık zaten geniş çıkıyor. Ama `runsPerCase` beyan edilen tekrar sayısını
-- taşıdığı için kaydın kendisi de "bu tamamlanmadı" demek zorunda; yoksa
-- okuyucu vaka başına o kadar deneme koşulduğunu sanır.
--
-- Alanın içi: { reason, recoveredAt, droppedLines? }. `droppedLines`, süreç bir
-- satırın ortasında öldüğünde okunamayan satır sayısı — atılıyor ama
-- sayılıyor.
ALTER TABLE "Run" ADD COLUMN "partial" JSONB;

-- Yarım bir kayıt sebepsiz olamaz: `partial` varsa `reason` dolu olmak zorunda.
-- Değişmez #1'in aynı mantığı — bir durumu bildirip gerekçesini bildirmemek,
-- okuyucuyu bilgisiz bırakırken bilgilendirilmiş sanmaktır.
ALTER TABLE "Run"
  ADD CONSTRAINT "run_partial_shape"
  CHECK (
    "partial" IS NULL
    OR (
      jsonb_typeof("partial") = 'object'
      AND "partial" ? 'reason'
      AND length(("partial" ->> 'reason')) > 0
      AND "partial" ? 'recoveredAt'
    )
  );
