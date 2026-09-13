#!/bin/sh
# İmajda Claude Code'un yükleyebileceği bir talimat dosyası varsa çıkış 1.
# Derleme adımında koşuyor (bulursa derleme düşer); imajda da duruyor ki aynı
# denetim bir konteynerde tekrar koşulabilsin. Bilerek geniş: yalnızca yükleme
# yollarına değil bütün dosya sistemine bakıyor — K0'da boştu, bir gün boş
# değilse karar elle verilsin. Asıl güvence yine koşum başına ölçüm
# (environment.memory); bu yalnızca imajın bozuk çıkmasını erken yakalıyor.
found=$(find / -xdev \( -path /proc -o -path /sys \) -prune -o \
  \( -name CLAUDE.md -o -name CLAUDE.local.md -o -name .claude -o -path /etc/claude-code \) -print 2>/dev/null)
if [ -n "$found" ]; then
  echo "instruction files in the image:" >&2
  echo "$found" >&2
  exit 1
fi
echo "no instruction files"
