-- 0.3.0-d — eş zamanlılık kayıtta durur.
--
-- Denemeler artık paralel koşabiliyor (`--concurrency`, varsayılan 1). Bu
-- **ortam hash'ine girmiyor**: host'un bildirdiği ortamın değil koşum
-- düzeninin özelliği ve tetiklenme oranını değiştirmesi beklenmiyor; hash'e
-- katmak farklı hızda koşulmuş iki ölçümü tetiklenme bakımından da
-- karşılaştırılamaz yapardı.
--
-- Ama kayda giriyor, çünkü **gecikme ve maliyet** eş zamanlı koşumda aynı şeyi
-- ölçmüyor: denemeler CPU'yu, belleği, portları ve host hız sınırını
-- paylaşıyor. Alanı okumadan iki koşumun süresini karşılaştırmak yanlış olur.
--
-- Null = 1. 0.3.0-d öncesi her koşum sıralıydı, o yüzden geriye dönük doldurma
-- gerekmiyor.
ALTER TABLE "Run" ADD COLUMN "concurrency" INTEGER;

-- Eş zamanlılık en az 1'dir. Sıfır ya da negatif bir değer, hiç koşmamış bir
-- koşumu koşmuş gibi gösteren bir kayıt olurdu.
ALTER TABLE "Run"
  ADD CONSTRAINT "run_concurrency_positive"
  CHECK ("concurrency" IS NULL OR "concurrency" >= 1);
