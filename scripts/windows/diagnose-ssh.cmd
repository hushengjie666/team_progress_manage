@echo off
setlocal
set "TM_SSH_DIAG_SCRIPT=%~f0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$lines=Get-Content -LiteralPath $env:TM_SSH_DIAG_SCRIPT; $start=[Array]::IndexOf($lines,'# POWERSHELL START'); & ([ScriptBlock]::Create(($lines[($start+1)..($lines.Length-1)] -join [Environment]::NewLine)))"
pause
exit /b
# POWERSHELL START
$ErrorActionPreference = "Stop"
$entryDir = Split-Path -Parent $env:TM_SSH_DIAG_SCRIPT
$report = Join-Path $entryDir "ssh-diagnostics.log"
$started = $false
try {
  Start-Transcript -Path $report -Append | Out-Null
  $started = $true
  Write-Host "TimeManage SSH read-only diagnosis. No installation or system configuration changes."
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  Write-Host ("Account: " + $identity.Name + "; elevated: " + $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))
  Write-Host ("OS: " + [Environment]::OSVersion + "; PowerShell: " + $PSVersionTable.PSVersion + "; CLR: " + [Environment]::Version)
  Write-Host "Current account privileges:"
  & whoami.exe /priv | ForEach-Object { Write-Host $_ }
  Write-Host "Windows authentication package configuration:"
  try {
    $lsa = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Lsa"
    Write-Host ("Authentication Packages: " + ($lsa."Authentication Packages" -join ", "))
    Write-Host ("RunAsPPL: " + $lsa.RunAsPPL)
    $acl = Get-Acl "HKLM:\SYSTEM\CurrentControlSet\Control\Lsa"
    Write-Host ("LSA registry ACL: " + $acl.Sddl)
  } catch { Write-Host ("Reading LSA configuration failed: " + $_.Exception.Message) }
  $service = Get-Service BvSshServer -ErrorAction SilentlyContinue
  if ($service) { Write-Host ("Bitvise service: " + $service.Status) }
  else { Write-Host "Bitvise service is not installed." }
  foreach ($dir in @("System32", "SysWOW64")) {
    $dll = Join-Path (Join-Path $env:windir $dir) "BvLsaEx.dll"
    if (Test-Path $dll) {
      Write-Host ("Authentication DLL: " + $dll + "; version: " + ([Diagnostics.FileVersionInfo]::GetVersionInfo($dll)).FileVersion)
      try { Write-Host ("DLL ACL: " + (Get-Acl $dll).Sddl) }
      catch { Write-Host ("Reading DLL ACL failed: " + $_.Exception.Message) }
    } else { Write-Host ("Authentication DLL absent: " + $dll) }
  }
  Write-Host "Recent Bitvise-related Windows events:"
  foreach ($logName in @("Application", "System")) {
    $events = @(Get-EventLog -LogName $logName -After (Get-Date).AddHours(-2) -EntryType Error,Warning -Newest 100 -ErrorAction SilentlyContinue | Where-Object { $_.Message -match "Bitvise|BvLsa|BvSsh" })
    foreach ($event in $events) {
      Write-Host ($logName + " / " + $event.TimeGenerated + " / " + $event.Source + " / " + $event.EventID)
      Write-Host $event.Message
    }
    if ($events.Count -eq 0) { Write-Host ($logName + ": no matching recent events.") }
  }
  $installer = $null
  foreach ($dir in @($entryDir, (Split-Path -Parent $entryDir), (Join-Path $entryDir "TimeManage-SSH-Complete"))) {
    if (-not $dir) { continue }
    $candidate = Join-Path $dir "Bitvise-SSH-Server.exe"
    if (Test-Path $candidate -PathType Leaf) { $installer = $candidate; break }
  }
  if ($installer) {
    $stream = [IO.File]::OpenRead($installer)
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $checksum = ([BitConverter]::ToString($hash.ComputeHash($stream))).Replace("-", "").ToLowerInvariant() }
    finally { $stream.Close(); $hash.Clear() }
    if ($checksum -ne "d1407f989d18f4505bf623eb1c33a68cd5c79a483214ebc1ff86bee9821293a6") { throw "Installer checksum mismatch; help command was not executed." }
    $stdout = Join-Path $entryDir "bitvise-exit-codes.log"
    $stderr = Join-Path $entryDir "bitvise-help-errors.log"
    $result = Start-Process $installer -ArgumentList "-help-codes" -Wait -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    Write-Host ("Installer help exit code: " + $result.ExitCode)
    Get-Content $stdout | ForEach-Object { Write-Host $_ }
    if (Test-Path $stderr) { Get-Content $stderr | ForEach-Object { Write-Host $_ } }
  } else { Write-Host "Installer not found. Place this diagnostic file beside Bitvise-SSH-Server.exe for installer help." }
  Write-Host ("DIAGNOSIS COMPLETE. Report: " + $report)
} catch {
  Write-Host ("DIAGNOSIS FAILED: " + $_.Exception.Message)
  Write-Host $_.InvocationInfo.PositionMessage
} finally {
  if ($started) { Stop-Transcript | Out-Null }
}
