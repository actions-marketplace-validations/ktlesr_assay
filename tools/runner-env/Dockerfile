# Temiz koşum ortamı — K1 (docs/runner-environment.md).
#
#   docker build -t assay-egress --target egress tools/runner-env
#   docker build -t assay-attempt tools/runner-env
#
# İki imaj tek dosyada: deneme konteyneri ve onun tek dış çıkışı (izin listesi).
# Sürümler pinli; yükseltmek bilerek bir imaj değişikliği ve ortam hash'ini
# kaydırır (K2 imaj özetini kayda yazacak).
FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e AS base

# --- Çıkış proxy'si: izin listesindeki adreslere HTTPS tüneli, başka hiçbir şey.
FROM base AS egress
COPY egress.mjs /egress.mjs
USER node
EXPOSE 3128
CMD ["node", "/egress.mjs"]

# --- Deneme imajı.
FROM base AS attempt
ARG CLAUDE_CODE_VERSION=2.1.270
ARG ASSAY_VERSION=0.4.5
# Ajan `npm install playwright` yazıyor ve o gün npm'deki son sürümü alıyor;
# tarayıcı revizyonu o sürümünkiyle aynı olmalı, yoksa ajan ~150 MB indirir.
# K0'da tam bu oldu. npm'deki sürüm ilerledikçe indirme geri gelir — izinli
# (cdn.playwright.dev), yalnızca yavaş; imajı yükseltme işareti.
ARG PLAYWRIGHT_VERSION=1.63.0
RUN apt-get update \
 && apt-get install -y --no-install-recommends git python3 ca-certificates curl procps \
 && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} @ktlsr/assay@${ASSAY_VERSION} \
 && npm cache clean --force
# Tarayıcının sistem kütüphaneleri root ister; tarayıcının kendisi aşağıda.
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install-deps chromium \
 && rm -rf /root/.npm /var/lib/apt/lists/*
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
