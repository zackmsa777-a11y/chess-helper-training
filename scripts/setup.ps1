#requires -Version 5.1
[CmdletBinding()]
param([switch]$InstallDependencies)

$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'This setup helper is for Windows. See WINDOWS-SETUP.md.' }
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'package-lock.json') -PathType Leaf)) {
    throw 'The project package-lock.json is missing. Run the helper from an intact source checkout.'
}
$nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
$npmCommand = Get-Command npm.cmd -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $nodeCommand -or -not $npmCommand) {
    throw 'Install an approved Node.js 22.15+ release with npm, then reopen PowerShell. This script does not install runtimes.'
}
$nodeVersion = (& $nodeCommand.Source --version).Trim()
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.(\d+)\.(\d+)') { throw 'Could not identify the installed Node.js version.' }
if ([int]$Matches[1] -lt 22 -or ([int]$Matches[1] -eq 22 -and [int]$Matches[2] -lt 15)) {
    throw "Node.js 22.15+ is required; installed version is $nodeVersion."
}
function Invoke-ProjectNpm {
    param([string[]]$Arguments)
    & $npmCommand.Source @Arguments
    if ($LASTEXITCODE -ne 0) { throw "npm $($Arguments[0]) failed with exit code $LASTEXITCODE. Setup stopped." }
}
Push-Location -LiteralPath $projectRoot
try {
    Write-Host "Using Node $nodeVersion in $projectRoot"
    if ($InstallDependencies) {
        Invoke-ProjectNpm -Arguments @('ci', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', (Join-Path $projectRoot 'work\npm-cache'))
    } elseif (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules') -PathType Container)) {
        throw 'Dependencies are missing. Run .\scripts\setup.ps1 -InstallDependencies after approving the pinned package download.'
    }
    Invoke-ProjectNpm -Arguments @('test')
    Invoke-ProjectNpm -Arguments @('run', 'build')
    Invoke-ProjectNpm -Arguments @('run', 'check')
    Write-Host ''
    Write-Host 'Ready. In Chrome, open chrome://extensions and choose Load unpacked:'
    Write-Host (Join-Path $projectRoot 'extension')
    Write-Host 'Local study works without sign-in. See WINDOWS-SETUP.md for the optional companion.'
} finally {
    Pop-Location
}
