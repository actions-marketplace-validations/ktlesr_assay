-- 0.3.2 — kayıt onu üreten Assay sürümünü taşır.
--
-- Verdict'in anlamı sürümler arasında değişti (0.2.0 reddedilen aktivasyonu
-- tetiklenme sayıyordu, 0.3.0 yarım kaydı `pass` sayabiliyordu). Sürümü
-- taşımayan bir kayıt hangi kurallarla yargılandığını söyleyemez.
--
-- Null = 0.3.1 ya da öncesi. Geriye dönük doldurma YAPILMIYOR: eski bir kaydın
-- hangi sürümden geldiği bilinmiyor ve tahmin edilen bir değer, bilinmeyeni
-- bilinen gibi gösterirdi. Okuma tarafı null'ı "0.3.1 or earlier" diye söylüyor.
ALTER TABLE "Run" ADD COLUMN "assayVersion" TEXT;

-- Boş string sürüm değildir; null ile aynı şeyi söyleyip farklı görünürdü.
ALTER TABLE "Run"
  ADD CONSTRAINT "run_assay_version_not_blank"
  CHECK ("assayVersion" IS NULL OR btrim("assayVersion") <> '');
