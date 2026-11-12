@echo off
title Cai agent in tem - laptop cam may in (MOT PHAT)
rem ============================================================================
rem  CAI-MAY-IN-1LAN.bat - tai tu nut "Tai bo cai may in (chay admin)" tren dashboard.
rem  Chay TREN LAPTOP CAM MAY IN TEM (Honeywell PC42t). Mot phat la xong:
rem    tu nang quyen admin -> tu lo Node+Git -> keo ma agent (khoa chi doc) -> cai.
rem  KHONG phai bo cai PC 5S: may nay chi chay agent in tem.
rem  12/11/2026 user: "chuyen may in gan qua laptop khac, lam bo cai o laptop do".
rem ============================================================================

net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "REPO=ssh://git@ssh.github.com:443/letam0317/th76tamle.git"
set "HSK_BAT=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=[IO.File]::ReadAllText($env:HSK_BAT); $i=$s.LastIndexOf('#'+'#PS-MAY-IN#'+'#'); iex $s.Substring($i)"
echo.
pause
exit /b

##PS-MAY-IN##
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$GOC = 'C:\AuditFactory\may-in'; $NHANH = 'cai-tien/bo-sung-factory'
function NapPath { $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') + ";$env:ProgramFiles\nodejs;$env:ProgramFiles\Git\cmd" }
function Co($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Dung($s) { Write-Host "  [X] $s" -ForegroundColor Red; exit 1 }
Write-Host ''
Write-Host "  === Cai agent in tem cho may $env:COMPUTERNAME ===" -ForegroundColor Cyan

# --- khoa nhung san ---
$kv = @{}
if ($env:HSK_KHOA_B64) { foreach ($l in ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:HSK_KHOA_B64)) -split "`n")) { if ($l.TrimEnd("`r") -match '^([A-Z0-9_]+)=(.+)$') { $kv[$matches[1]] = $matches[2] } } }
if (-not $kv['APPSCRIPT_KEY'] -or -not ($kv['GH_DOC_KHOA'] -or $kv['GH_DOC_KHOA_DU'])) { Dung 'Bo cai nay KHONG co khoa. Mo dashboard, DANG NHAP, roi bam lai nut "Tai bo cai may in".' }

# --- Node + Git ---
NapPath
$wg = Co winget
if (-not (Co node)) {
  Write-Host '  [..] Cai Node LTS...' -ForegroundColor Gray
  if ($wg) { winget install -e --id OpenJS.NodeJS.LTS --silent --scope machine --accept-source-agreements --accept-package-agreements | Out-Null }
  NapPath
  if (-not (Co node)) {
    $lts = (Invoke-RestMethod 'https://nodejs.org/dist/index.json') | Where-Object { $_.lts } | Select-Object -First 1
    $msi = "$env:TEMP\node-$($lts.version)-x64.msi"
    Invoke-WebRequest "https://nodejs.org/dist/$($lts.version)/node-$($lts.version)-x64.msi" -OutFile $msi -UseBasicParsing
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait; NapPath
  }
}
if (-not (Co git)) {
  Write-Host '  [..] Cai Git...' -ForegroundColor Gray
  if ($wg) { winget install -e --id Git.Git --silent --scope machine --accept-source-agreements --accept-package-agreements | Out-Null }
  NapPath
  if (-not (Co git)) {
    $a = (Invoke-RestMethod 'https://api.github.com/repos/git-for-windows/git/releases/latest' -Headers @{ 'User-Agent' = 'cai-may-in' }).assets | Where-Object { $_.name -match '^Git-.*-64-bit\.exe$' } | Select-Object -First 1
    $exe = "$env:TEMP\$($a.name)"; Invoke-WebRequest $a.browser_download_url -OutFile $exe -UseBasicParsing
    Start-Process $exe -ArgumentList '/VERYSILENT /NORESTART /SUPPRESSMSGBOXES' -Wait; NapPath
  }
}
if (-not (Co node)) { Dung 'Chua cai duoc Node - cai Node LTS tay (nodejs.org) roi chay lai file nay.' }
if (-not (Co git)) { Dung 'Chua cai duoc Git - cai Git tay (git-scm.com) roi chay lai file nay.' }
Write-Host ("  [OK] Node " + (node -v) + " / " + (git --version)) -ForegroundColor Green

# --- keo ma agent (kho rieng tu: khoa SSH chi doc, cong 443) ---
$env:GIT_TERMINAL_PROMPT = '0'; $env:GCM_INTERACTIVE = 'never'
$SPARSE = @('/hasaki/in-tem-agent.mjs', '/hasaki/so-ghi.mjs', '/hasaki/_IN-RAW.ps1', '/hasaki/_MAY-IN-SERVER.ps1', '/hasaki/_AGENT-IN-TEM-AN.vbs', '/hasaki/cai-pc/CAI-MAY-IN.ps1')
New-Item -ItemType Directory -Force 'C:\AuditFactory' | Out-Null
$okMa = $false
foreach ($ten in @('GH_DOC_KHOA', 'GH_DOC_KHOA_DU')) {
  if (-not $kv[$ten] -or $kv[$ten] -like 'dpapi:*') { continue }
  $kf = "$env:TEMP\hsk-may-in-$PID.key"
  [IO.File]::WriteAllText($kf, (([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($kv[$ten]))) -replace "`r`n", "`n"))
  $env:GIT_SSH_COMMAND = 'ssh -i "' + ($kf -replace '\\', '/') + '" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o ConnectTimeout=25'
  $ErrorActionPreference = 'Continue'
  if (Test-Path "$GOC\.git") {
    Write-Host '  [..] Da co ma - dong bo ban moi...' -ForegroundColor Gray
    git -C $GOC sparse-checkout set --no-cone @SPARSE 2>&1 | Out-Null
    git -C $GOC fetch --depth 1 origin $NHANH 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { git -C $GOC reset --hard FETCH_HEAD 2>&1 | Out-Null; $okMa = ($LASTEXITCODE -eq 0) }
  } else {
    Write-Host '  [..] Keo ma agent lan dau...' -ForegroundColor Gray
    if (Test-Path $GOC) { Remove-Item $GOC -Recurse -Force }
    git clone --depth 1 --filter=blob:none --sparse --branch $NHANH $env:REPO $GOC 2>&1 | ForEach-Object { Write-Host "       $_" }
    if ($LASTEXITCODE -eq 0) { git -C $GOC sparse-checkout set --no-cone @SPARSE 2>&1 | Out-Null; $okMa = ($LASTEXITCODE -eq 0) }
  }
  $ErrorActionPreference = 'Stop'
  Remove-Item $kf -Force -ErrorAction SilentlyContinue
  if ($okMa) { break }
}
Remove-Item Env:\GIT_SSH_COMMAND -ErrorAction SilentlyContinue
$ErrorActionPreference = 'Continue'; git config --system --add safe.directory 'C:/AuditFactory/may-in' 2>&1 | Out-Null; $ErrorActionPreference = 'Stop'   # task SYSTEM chay git tren ma do admin keo ve
if (-not $okMa -or -not (Test-Path "$GOC\hasaki\cai-pc\CAI-MAY-IN.ps1")) { Dung 'Khong keo duoc ma (mang chan ssh.github.com:443 hoac khoa het han). Bao quan tri.' }
Write-Host '  [OK] Da keo ma agent' -ForegroundColor Green

# --- bo cai chinh ---
& "$GOC\hasaki\cai-pc\CAI-MAY-IN.ps1"
