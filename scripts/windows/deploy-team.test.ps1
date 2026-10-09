param([string]$SourcePath, [string]$RequestPath, [string]$PayloadPath, [string]$InstallDir, [string]$Scenario, [string]$TracePath)
# Portable harness for deployment control flow; Windows services/COM are replaced.
$ErrorActionPreference = "Stop"
$global:tracePath = $TracePath
$global:payloadPath = $PayloadPath
$global:installPath = $InstallDir
$global:scenario = $Scenario
function Write-Trace([string]$Message) { Add-Content $global:tracePath $Message }
function Get-Service {
  param([string]$Name, $ErrorAction)
  $service = [PSCustomObject]@{ Status = "Running" }
  $service | Add-Member -MemberType ScriptMethod -Name WaitForStatus -Value { param($status, $timeout) }
  return $service
}
function Stop-Service { param($Name, $ErrorAction); Write-Trace "stop" }
function Start-Service { param($Name, $ErrorAction); Write-Trace "start" }
function Set-Service { param($Name, $StartupType); Write-Trace "automatic" }
function Start-Sleep { param($Seconds, $Milliseconds) }
function Get-WmiObject {
  param($Class, $Filter)
  return [PSCustomObject]@{ PathName = '"' + (Join-Path $global:installPath "server/timemanage-team.exe") + '" service' }
}
function New-Object {
  param([string]$TypeName, [string]$ComObject)
  if ($ComObject -eq "Shell.Application") {
    $shell = [PSCustomObject]@{}
    $shell | Add-Member -MemberType ScriptMethod -Name NameSpace -Value {
      param($path)
      $folder = [PSCustomObject]@{ Path = $path }
      $folder | Add-Member -MemberType ScriptMethod -Name Items -Value { return $global:payloadPath }
      $folder | Add-Member -MemberType ScriptMethod -Name CopyHere -Value {
        param($items, $flags)
        Copy-Item -Recurse -Force -Path (Join-Path $items "*") -Destination $this.Path
      }
      return $folder
    }
    return $shell
  }
  if ($TypeName -eq "System.Web.Script.Serialization.JavaScriptSerializer") {
    $serializer = [PSCustomObject]@{ MaxJsonLength = 0 }
    $serializer | Add-Member -MemberType ScriptMethod -Name DeserializeObject -Value { param($text); return ConvertFrom-Json -AsHashtable $text }
    return $serializer
  }
  throw "Unexpected New-Object in deployment test: $TypeName / $ComObject"
}
$source = [IO.File]::ReadAllText($SourcePath).Replace("Add-Type -AssemblyName System.Web.Extensions", "")
$mockHealth = @'
function Read-Health {
  if ($global:scenario -eq "health-failure") { throw "Simulated unavailable backend" }
  return @{release_version=$request.ReleaseVersion;api_protocol_version=$request.ApiVersion;database_schema_version=$request.SchemaVersion;minimum_client_release=$request.MinimumClientRelease;database_status="ready"}
}
'@
$source = $source.Replace('$stopped = $false', $mockHealth + "`n" + '$stopped = $false')
& ([ScriptBlock]::Create($source)) -RequestPath $RequestPath
