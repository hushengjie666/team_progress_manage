# Compatible with Windows Server 2008 R2 / Windows PowerShell 2.0.
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

function Get-Sha256([string]$Path) {
  $stream = [IO.File]::OpenRead($Path)
  $hash = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($hash.ComputeHash($stream))).Replace("-", "").ToLowerInvariant() }
  finally { $stream.Dispose(); $hash.Dispose() }
}

try {
  $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw "Run this script as administrator." }
  $options = & (Join-Path $scriptDir "setup-config.ps1")
  $ip = [Net.IPAddress]::Parse($options.ClientIp)
  if ($ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or $options.ClientIp -eq "0.0.0.0") { throw "A single client IPv4 address is required." }
  if ($options.Port -lt 1 -or $options.Port -gt 65535) { throw "Invalid SSH port." }
  if (-not (Test-Path $options.RemoteRoot -PathType Container)) { throw "Remote upload directory does not exist: $($options.RemoteRoot)" }
  $account = New-Object Security.Principal.NTAccount($env:COMPUTERNAME, $options.AccountName)
  $null = $account.Translate([Security.Principal.SecurityIdentifier])
  $keyFile = Join-Path $scriptDir "deploy-key.pub"
  if (-not (Test-Path $keyFile)) { throw "deploy-key.pub is missing." }
  $stateDir = Join-Path $env:ProgramData "TimeManage-SSH"
  $marker = Join-Path $stateDir "setup-owned.txt"
  $service = Get-Service BvSshServer -ErrorAction SilentlyContinue
  if ($service -and -not (Test-Path $marker)) { throw "An existing Bitvise installation was found. It has not been changed; import the key into that installation instead." }
  if (-not $service) {
    if ([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object { $_.Port -eq $options.Port }) { throw "SSH port is already in use." }
    $installer = Join-Path $scriptDir "Bitvise-SSH-Server.exe"
    if ((Get-Sha256 $installer) -ne $options.InstallerSha256) { throw "Installer checksum mismatch." }
    Write-Host "Bitvise Standard Edition: 30-day evaluation, then a commercial license is required."
    Write-Host "License: https://bitvise.com/winsshd-license"
    if ((Read-Host "Read and accept the license, then type YES to install") -cne "YES") { throw "Installation cancelled." }
    New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
    Set-Content -Path $marker -Value "Created by TimeManage SSH setup"
    $result = Start-Process $installer -ArgumentList "-defaultInstance -acceptEULA" -Wait -PassThru
    if ($result.ExitCode -ne 0 -and $result.ExitCode -ne 16) { throw "Bitvise installation failed: $($result.ExitCode)" }
  }
  $cfg = New-Object -ComObject "Bitvise.BssCfg"
  $cfg.SetInstance("")
  $cfg.settings.Lock()
  try {
    $cfg.settings.Load()
    $cfg.SaveText($cfg.settings.Dump(), (Join-Path $stateDir ("settings-before-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".txt")))
    $cfg.settings.bindings.ipv4.Clear()
    $cfg.settings.bindings.ipv6.Clear()
    $cfg.settings.bindings.ipv4.new.port = $options.Port
    $cfg.settings.bindings.ipv4.new.listenInterface = "0.0.0.0"
    $cfg.settings.bindings.ipv4.new.serviceType = $cfg.enums.ServiceType.ssh
    $cfg.settings.bindings.ipv4.NewCommit()
    $cfg.settings.windowsFirewall.sshPortsFirewallSetting = $cfg.enums.WindowsFirewallSetting.dontChange
    foreach ($group in $cfg.settings.access.winGroups.entries) { $group.loginAllowed = $false }
    $cfg.settings.access.winAccounts.Clear()
    $cfg.settings.access.virtAccounts.Clear()
    $newAccount = $cfg.settings.access.winAccounts.new
    $newAccount.winAccountType = $cfg.enums.WinAccountType.localAccount
    $newAccount.winAccount = $options.AccountName
    $newAccount.loginAllowed = $cfg.enums.DefaultGroupYesNo.yes
    $newAccount.auth.passwordAuth = $cfg.enums.AuthDisp.disabled
    $newAccount.auth.publicKeyAuth = $cfg.enums.AuthDisp.required
    $newAccount.auth.keys.ImportFromFile($keyFile)
    $newAccount.term.shellAccessType = $cfg.enums.ShellAccess.cmdPrompt
    $newAccount.term.useDefaultInitDir = $false
    $newAccount.term.initDir = $options.RemoteRoot
    $newAccount.xfer.permitSftp = $cfg.enums.DefaultGroupYesNo.yes
    $newAccount.xfer.inheritMountPoints = $false
    $newAccount.xfer.inheritAllMountPoints = $cfg.enums.DefaultGroupYesNo.no
    $newAccount.xfer.mountPoints.Clear()
    $newAccount.xfer.mountPoints.new.sfsMountPath = "/"
    $newAccount.xfer.mountPoints.new.realRootPath = $options.RemoteRoot
    $newAccount.xfer.mountPoints.NewCommit()
    $cfg.settings.access.winAccounts.NewCommit()
    $cfg.settings.access.elevateByDef = $true
    $rules = $cfg.settings.access.clientAddresses
    $rules.Clear()
    foreach ($address in @($options.ClientIp, "127.0.0.1")) {
      $rules.new.addressRule.addressType = $cfg.enums.AddressVer6Type.ipv4
      $rules.new.addressRule.ipv4 = $address
      $rules.new.instr.allowConnect = $true
      $rules.NewCommit()
    }
    $rules.new.addressRule.addressType = $cfg.enums.AddressVer6Type.anyIP
    $rules.new.instr.allowConnect = $false
    $rules.NewCommit()
    $cfg.settings.Save()
  } finally { $cfg.settings.Unlock() }
  $null = & netsh.exe advfirewall firewall delete rule "name=TimeManage SSH"
  $null = & netsh.exe advfirewall firewall add rule "name=TimeManage SSH" dir=in action=allow protocol=TCP "localport=$($options.Port)" "remoteip=$($options.ClientIp)" profile=any
  if ($LASTEXITCODE -ne 0) { throw "Windows firewall configuration failed." }
  $cfg.keypairs.Lock()
  try {
    $cfg.keypairs.Load()
    if (-not $cfg.keypairs.ExistsEmployed($cfg.enums.KeypairAlgId.ed25519)) {
      $cfg.keypairs.GenerateNewKeypair($cfg.enums.KeypairAlgId.ed25519, $true)
      $cfg.keypairs.Save($true)
    }
  } finally { $cfg.keypairs.Unlock() }
  Set-Service BvSshServer -StartupType Automatic
  if ((Get-Service BvSshServer).Status -eq "Running") { Restart-Service BvSshServer }
  else { Start-Service BvSshServer }
  (Get-Service BvSshServer).WaitForStatus("Running", [TimeSpan]::FromSeconds(30))
  $listening = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $client = New-Object Net.Sockets.TcpClient
    try { $client.Connect("127.0.0.1", $options.Port); $listening = $true; break }
    catch { Start-Sleep -Milliseconds 250 }
    finally { $client.Close() }
  }
  if (-not $listening) { throw "SSH service started but its port is not listening." }
  $cfg.keypairs.Load()
  $hostLines = @()
  foreach ($key in $cfg.keypairs.entries) {
    if ($key.employed) {
      $publicKey = $key.ExportPublicKeyToBase64String($cfg.enums.PublicKeyFormat.openSsh)
      $hostLines += "$($options.HostName) " + $publicKey
      $digest = [Security.Cryptography.SHA256]::Create()
      try { $fingerprint = [Convert]::ToBase64String($digest.ComputeHash([Convert]::FromBase64String(($publicKey -split '\s+')[1]))).TrimEnd('=') }
      finally { $digest.Dispose() }
      Write-Host "Host key: $($key.alg) SHA256:$fingerprint"
    }
  }
  if ($hostLines.Count -eq 0) { throw "No active SSH host keys were found." }
  $hostLines | Set-Content -Encoding ASCII (Join-Path $scriptDir "server-host-keys.txt")
  Write-Host "SSH READY. Allow TCP $($options.Port) from $($options.ClientIp)/32 in the cloud security group."
  Write-Host "On the Mac, run: npm run server:ssh:check"
} catch {
  Write-Host ("FAILED: " + $_.Exception.Message) -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}
Read-Host "Press Enter to close"
