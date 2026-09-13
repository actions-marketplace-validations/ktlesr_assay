# K0 — Temiz koşum ortamının varsayım ve kapasite ölçümü (docs/runner-environment.md, "K0 sonuçları").
# Atılacak bir imaj; K1 değil. Kullanım: cd tools/k0 && docker build -t assay-k0:attempt .
# K0 — atılacak deneme imajı. Kapasite ve varsayım ölçümü için; K1'in kendisi değil.
FROM node:22.20.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git python3 ca-certificates curl procps && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code@2.1.270 @ktlsr/assay@0.4.5 && npm cache clean --force
# Playwright'ın tarayıcısı imajda: yoksa her deneme ~150 MB indirir (ajan npx playwright kullanıyor).
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
RUN npx -y playwright@1.55.0 install --with-deps chromium && chmod -R a+rX /opt/ms-playwright && rm -rf /root/.npm
# node imajındaki "node" kullanıcısı uid 1000; ev dizini boş.
RUN mkdir -p /work && chown node:node /work
USER node
ENV HOME=/home/node
WORKDIR /work
