#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ $_ -cmatch '^[a-p]{32}$' })]
    [string]$ExtensionId
)

$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'The encrypted companion currently requires Windows.' }
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$entry = Join-Path $projectRoot 'companion\main.js'
if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) { throw 'companion/main.js is missing from this checkout.' }
$nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $nodeCommand) { throw 'An approved Node.js 22.15+ installation is required. See WINDOWS-SETUP.md.' }
$nodeVersion = (& $nodeCommand.Source --version).Trim()
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.(\d+)\.(\d+)') { throw 'Could not identify the installed Node.js version.' }
if ([int]$Matches[1] -lt 22 -or ([int]$Matches[1] -eq 22 -and [int]$Matches[2] -lt 15)) {
    throw "Node.js 22.15+ is required; installed version is $nodeVersion."
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules') -PathType Container)) {
    throw 'Dependencies are missing. Prepare the project with scripts/setup.ps1 -InstallDependencies first.'
}
Push-Location -LiteralPath $projectRoot
try {
    Write-Host 'Starting the local companion on 127.0.0.1:43187. Leave this terminal open; Ctrl+C stops it.'
    Write-Host 'Sign-in starts only when you choose it in the extension settings.'
    & $nodeCommand.Source $entry --extension-id $ExtensionId
    if ($LASTEXITCODE -ne 0) { throw "Companion exited with code $LASTEXITCODE. See WINDOWS-SETUP.md for troubleshooting." }
} finally {
    Pop-Location
}
