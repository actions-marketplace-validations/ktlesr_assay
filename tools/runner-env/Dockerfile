# Temiz koşum ortamı — deneme imajı (docs/runner-environment.md, K1–K2).
#
#   docker build -t assay-attempt tools/runner-env
#   assay run <suite> --skill <dir> --container assay-attempt --container-api <name:port>
#
# Aynı imaj iki iş görüyor: deneme konteyneri ve koşumun çıkış proxy'si
# (`node /opt/assay/egress.mjs`). Böylece proxy'nin kodu da kayda giren imaj
# özetinin içinde.
#
# Assay'in kendi kodu imajda YOK: runner koşum sırasında ana makinedeki
# runner/core/adaptör `dist`ini salt okunur bağlıyor (container.ts). İmaj yeniden
# derlenmeden geliştirilen bir sürüm konteynerde eski bir sürümle ölçmesin diye.
# Sürümler pinli; yükseltmek bilerek bir imaj değişikliği ve ortam hash'ini kaydırır.
FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e

ARG CLAUDE_CODE_VERSION=2.1.270
# Ajan `npm install playwright` yazıyor ve o gün npm'deki son sürümü alıyor;
# tarayıcı revizyonu o sürümünkiyle aynı değilse ajan ~150 MB indirir (K0'da
# tam bu oldu). npm'deki sürüm ilerledikçe indirme geri gelir — izinli
# (cdn.playwright.dev), yalnızca yavaş; imajı yükseltme işareti.
ARG PLAYWRIGHT_VERSION=1.63.0

RUN apt-get update \
 && apt-get install -y --no-install-recommends git python3 ca-certificates curl procps \
 && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} && npm cache clean --force
# Tarayıcının sistem kütüphaneleri root ister; tarayıcının kendisi aşağıda.
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install-deps chromium \
 && rm -rf /root/.npm /var/lib/apt/lists/*

# Assay'in çalışma zamanı bağımlılıkları (core'un), depodaki kilit dosyasıyla aynı
# sürümler. Bağlanan `@ktlsr/*` paketleri bunları /opt/assay/node_modules'ta buluyor.
RUN mkdir -p /opt/assay && cd /opt/assay \
 && npm init -y >/dev/null \
 && npm install --no-audit --no-fund ajv@8.20.0 yaml@2.9.0 zod@4.5.4 \
 && npm cache clean --force && chmod -R a+rX /opt/assay
COPY --chmod=644 egress.mjs /opt/assay/egress.mjs
COPY --chmod=755 check-instructions.sh /usr/local/bin/assay-check-instructions
RUN mkdir -p /work && chown node:node /work

# node imajındaki "node" kullanıcısı uid 1000.
USER node
ENV HOME=/home/node
# Tarayıcı Playwright'ın VARSAYILAN yolunda (~/.cache/ms-playwright), çünkü
# adaptörün ortam allowlist'i PLAYWRIGHT_BROWSERS_PATH'i ajana geçirmiyor — K0'nun
# /opt'a kurduğu tarayıcıyı ajan bu yüzden görmedi. Her deneme kendi konteynerinde
# başladığı için HOME her denemede imajdakiyle aynı; tarayıcı talimat değil.
# Kabuk başlangıç dosyaları siliniyor: HOME'da ajanın davranışını değiştirebilecek
# hiçbir şey kalmasın.
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install chromium \
 && rm -rf /home/node/.npm /home/node/.bashrc /home/node/.profile /home/node/.bash_logout
RUN assay-check-instructions
WORKDIR /work
