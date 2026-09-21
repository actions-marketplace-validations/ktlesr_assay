-- 0.3.0-a — kayan alanı adıyla söyleyebilmek için ortam kaydı saklanıyor.
--
-- `pinEnvironmentHash` "bir şey değişti" diyebiliyor, "ne değişti" diyemiyor.
-- Gerçek bir koşumda bunun bedeli görüldü: çapraz izin modu karşılaştırması
-- doğru şekilde reddedildi ama gerekçe "systemPromptHash changed" oldu — o
-- alan iki kayıtta da `not-provided-by-host` iken. Değişen `permissionMode`
-- idi ve kayıt onu hash'in içinde gömülü tutuyordu.
--
-- Hash'in girdisi olan nesne artık kayda da yazılıyor: model, sürüm, output
-- style, izin modu, araç/skill/agent/plugin listeleri.
ALTER TABLE "Run" ADD COLUMN "environment" JSONB;

-- 0.3.0 ÖNCESİ SATIRLAR.
--
-- Onlarda ortam bileşenleri hiç saklanmadı; alan null kalıyor. Bu bir kayıp
-- değil, bilginin yokluğu: o koşumlarda hash vardı ama girdisi atılmıştı.
-- `compareRuns` bir tarafta bileşen yoksa hash düzeyinde konuşuyor ve
-- uydurmuyor. Geriye dönük doldurma yok — hash'ten nesne türetilemez.
