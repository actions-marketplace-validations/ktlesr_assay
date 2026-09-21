<#
.SYNOPSIS
  Git Bash'in domain aramasında asılıp `add_item ... errno 1` ile çökmesini
  durdurur. Yönetici hakkı ister (Git kurulumu Program Files altında).

.DESCRIPTION
  Belirti: `sh.exe -c 'echo ok'` denemelerinin bir kısmı

      *** fatal error - add_item ("\??\C:\Program Files\Git", "/", ...) failed, errno 1

  ile ölüyor, ölmeyenler ~15 saniye sürüyor.

  Kök neden: makine artık var olmayan bir domain'e kayıtlı
  (`Win32_ComputerSystem.PartOfDomain = True`). msys2 çalışma zamanı, hesap
  çözümü için `nsswitch.conf`taki `db` kaynağını kullanıyor ve bu, o domain
  için `DsGetDcName` çağrısına gidiyor. Çağrı ~16 saniyede zaman aşımına
  uğruyor; msys'in paylaşılan bellek başlatmasını seri hâle getiren spinlock
  ise 15 saniyede pes ediyor. Süre dolduğunda ikinci bir süreç kritik bölgeye
  giriyor, mount tablosunu ikinci kez kurmaya çalışıyor ve `add_item` EPERM
  döndürüyor.

  Düzeltme: hesap çözümünü domain'e hiç gitmeyecek şekilde dosyaya sabitlemek.
  `/etc/passwd` mevcut kullanıcı için üretiliyor ve `nsswitch.conf`ta
  `passwd:` kaynağından `db` çıkarılıyor.

  Değişen dosyalar (ikisi de Git kurulumunun içinde):
    C:\Program Files\Git\etc\nsswitch.conf   — passwd: files db  ->  passwd: files
    C:\Program Files\Git\etc\passwd          — yoktu, üretiliyor

  Yedek: her iki dosyanın öncesi `etc\assay-backup-<zaman damgası>\` altına
  kopyalanıyor ve geri alma bu kopyadan yapılıyor.

.PARAMETER Rollback
  Son yedeği geri yükler: nsswitch.conf eski hâline döner, üretilen
  /etc/passwd silinir.

.PARAMETER GitRoot
  Git for Windows kurulum kökü. Varsayılan: C:\Program Files\Git

.EXAMPLE
  # Yükseltilmiş PowerShell'de:
  pwsh -NoProfile -File tools\fix-msys-domain-stall.ps1

.EXAMPLE
  pwsh -NoProfile -File tools\fix-msys-domain-stall.ps1 -Rollback
#>
[CmdletBinding()]
param(
  [switch] $Rollback,
  [string] $GitRoot = 'C:\Program Files\Git'
)

$ErrorActionPreference = 'Stop'

$etc        = Join-Path $GitRoot 'etc'
$nsswitch   = Join-Path $etc 'nsswitch.conf'
$passwdFile = Join-Path $etc 'passwd'
$mkpasswd   = Join-Path $GitRoot 'usr\bin\mkpasswd.exe'
$sh         = Join-Path $GitRoot 'bin\sh.exe'
$marker     = '# assay: passwd kaynagindan db cikarildi (domain stall)'

function Test-Elevated {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  (New-Object Security.Principal.WindowsPrincipal $id).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Elevated)) {
  Write-Error @"
Bu betik yonetici hakki ister: $etc Program Files altinda ve normal
kullanici yazamiyor. Yukseltilmis bir PowerShell acip ayni komutu calistirin.
"@
  exit 2
}
if (-not (Test-Path $nsswitch)) { Write-Error "bulunamadi: $nsswitch"; exit 2 }

# ---------------------------------------------------------------------------
# Geri alma
# ---------------------------------------------------------------------------
if ($Rollback) {
  $backup = Get-ChildItem $etc -Directory -Filter 'assay-backup-*' |
            Sort-Object Name | Select-Object -Last 1
  if (-not $backup) { Write-Error "geri alinacak yedek yok ($etc\assay-backup-*)"; exit 2 }

  $savedNsswitch = Join-Path $backup.FullName 'nsswitch.conf'
  if (Test-Path $savedNsswitch) {
    Copy-Item $savedNsswitch $nsswitch -Force
    Write-Output "geri yuklendi: nsswitch.conf  <- $($backup.Name)"
  }
  $savedPasswd = Join-Path $backup.FullName 'passwd'
  if (Test-Path $savedPasswd) {
    Copy-Item $savedPasswd $passwdFile -Force
    Write-Output "geri yuklendi: passwd         <- $($backup.Name)"
  } elseif (Test-Path $passwdFile) {
    # Yedekte yoktu, yani dosyayi biz urettik.
    Remove-Item $passwdFile -Force
    Write-Output 'silindi: /etc/passwd (bu betik uretmisti)'
  }
  Write-Output 'ROLLBACK TAMAM'
  exit 0
}

# ---------------------------------------------------------------------------
# Uygula
# ---------------------------------------------------------------------------
$current = Get-Content $nsswitch -Raw
if ($current -match [regex]::Escape($marker)) {
  Write-Output 'zaten uygulanmis; degisiklik yapilmadi'
  exit 0
}

$stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $etc "assay-backup-$stamp"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item $nsswitch (Join-Path $backup 'nsswitch.conf') -Force
if (Test-Path $passwdFile) { Copy-Item $passwdFile (Join-Path $backup 'passwd') -Force }
Write-Output "yedek: $backup"

# 1) /etc/passwd — yalnizca mevcut kullanici.
#
#    DIKKAT: `mkpasswd` da bir msys ikilisi, yani duzeltmeye calistigimiz
#    arizanin icinde. Ilk uygulama denemesinde tam burada asildi. Bu yuzden
#    satir Windows API'sinden hesaplaniyor; `mkpasswd` yalnizca calisirsa
#    dogrulama icin kullaniliyor.
#
#    Cygwin esleme kurali: yerel makine hesabinda uid = 0x30000 + RID,
#    birincil grup "None" (RID 513). Isim ayiraci `+`.
function New-PasswdLine {
  $id   = [Security.Principal.WindowsIdentity]::GetCurrent()
  $sid  = $id.User.Value
  $uid  = 196608 + [int](($sid -split '-')[-1])   # 0x30000 + RID
  $gid  = 196608 + 513                            # birincil grup: None/Domain Users
  $acct = ($id.Name -split '\\')[-1]
  $mach = $env:COMPUTERNAME
  # C:\Users\x -> /c/Users/x  ($home yazilamaz, PowerShell'de sabit)
  $hp   = $env:USERPROFILE -replace '\\', '/'
  $hp   = '/' + $hp.Substring(0, 1).ToLower() + $hp.Substring(2)
  "${mach}+${acct}:*:${uid}:${gid}:U-${mach}\${acct},${sid}:${hp}:/usr/bin/bash"
}

$line = New-PasswdLine
Write-Output "hesaplandi: $line"

# mkpasswd 60 sn icinde cevap verirse onu tercih et ve farki bildir.
if (Test-Path $mkpasswd) {
  $job = Start-Job -ScriptBlock { param($exe) & $exe -c 2>$null } -ArgumentList $mkpasswd
  if (Wait-Job $job -Timeout 60) {
    $fromTool = Receive-Job $job | Where-Object { $_ -match '^[^:]+:' } | Select-Object -First 1
    if ($fromTool) {
      if ($fromTool -ne $line) { Write-Warning "mkpasswd farkli satir verdi, onu kullaniyorum:`n  $fromTool" }
      $line = $fromTool
    }
  } else {
    Write-Output 'mkpasswd 60 sn icinde donmedi (beklenen: arizanin kendisi); hesaplanan satir kullaniliyor'
  }
  Remove-Job $job -Force -ErrorAction SilentlyContinue
}
Set-Content -Path $passwdFile -Value $line -Encoding ascii -NoNewline:$false
Write-Output "yazildi: /etc/passwd -> $line"

# 2) nsswitch.conf — passwd kaynagindan db cikar.
#    Sinif [ \t] bilerek: `\s` satir sonunu da yerdi ve onceki bos satir
#    silinirdi (kuru kosumda gorulup duzeltildi).
$updated = $current -replace '(?m)^[ \t]*passwd:[ \t]*files[ \t]+db[ \t]*$', "passwd: files`n$marker"
if ($updated -eq $current) {
  Write-Error "nsswitch.conf'ta 'passwd: files db' satiri bulunamadi; elle bakin"
  exit 1
}
# db_enum da dosyaya sabitlensin: enumerasyon (getpwent) db'ye hic gitmesin.
$updated = $updated -replace '(?m)^[ \t]*db_enum:[ \t]*.*$', 'db_enum: none'
Set-Content -Path $nsswitch -Value $updated -Encoding ascii
Write-Output 'yazildi: nsswitch.conf -> passwd: files, db_enum: none'

# ---------------------------------------------------------------------------
# Dogrula
# ---------------------------------------------------------------------------
Write-Output '--- dogrulama: 10 kosum ---'
$fail = 0; $times = @()
for ($i = 1; $i -le 10; $i++) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $r  = & $sh -c 'echo ok' 2>&1
  $sw.Stop(); $times += $sw.ElapsedMilliseconds
  if ("$r" -notmatch 'ok') { $fail++ }
}
$max = [int]($times | Measure-Object -Maximum).Maximum
$avg = [int]($times | Measure-Object -Average).Average
Write-Output "basarisiz: $fail/10 | ort ${avg}ms maks ${max}ms"
Write-Output "id -un: $(& $sh -c 'id -un' 2>&1)"

if ($fail -gt 0) {
  Write-Warning 'hala basarisiz kosum var; -Rollback ile geri alabilirsiniz'
  exit 1
}
Write-Output 'TAMAM'
