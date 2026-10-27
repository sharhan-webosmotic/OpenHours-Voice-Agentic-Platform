# =============================================================================
# claude-skills - setup.ps1
#
# PowerShell entry point that delegates to setup.sh. The actual setup logic
# lives in setup.sh (single source of truth). This wrapper:
#   1. Locates a bash interpreter (Git Bash > WSL > MSYS)
#   2. Offers to install Git for Windows via winget if no bash is found
#   3. Forwards all arguments to setup.sh
#
# Usage (from PowerShell):
#   .\setup.ps1                      # interactive setup
#   .\setup.ps1 --yes                # auto-confirm all prompts
#   .\setup.ps1 --update-settings    # refresh settings.json from template
#   .\setup.ps1 -h                   # show setup.sh help
# =============================================================================

[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $ForwardArgs
)

$ErrorActionPreference = 'Stop'

function Find-Bash {
    # 1. Standard Git for Windows install locations (most reliable).
    $candidates = @(
        (Join-Path $env:ProgramFiles      'Git\bin\bash.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Git\bin\bash.exe'),
        (Join-Path $env:LOCALAPPDATA      'Programs\Git\bin\bash.exe')
    )
    foreach ($p in $candidates) {
        if ($p -and (Test-Path $p)) { return $p }
    }

    # 2. PATH lookups — but SKIP the C:\Windows\System32\bash.exe stub.
    #    That stub is the WSL launcher and only works if a WSL distro is installed;
    #    on a Windows box without WSL it returns "No such file or directory".
    foreach ($cmd in (Get-Command bash.exe -All -ErrorAction SilentlyContinue)) {
        $src = $cmd.Source
        if ($src -and ($src -notmatch '\\System32\\bash\.exe$')) {
            return $src
        }
    }

    # 3. WSL — only if a distro is actually registered (wsl -l -q returns names).
    $wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
    if ($wsl) {
        try {
            $distros = & wsl.exe -l -q 2>$null
            if ($LASTEXITCODE -eq 0 -and $distros -and ($distros -join '').Trim().Length -gt 0) {
                return 'WSL'
            }
        } catch { }
    }

    return $null
}

function Install-GitViaWinget {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "winget is not available on this system." -ForegroundColor Yellow
        Write-Host "Install Git for Windows manually from: https://git-scm.com/download/win"
        Write-Host "then re-run .\setup.ps1"
        return $false
    }

    Write-Host ""
    Write-Host "Running: winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements"
    winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
    return ($LASTEXITCODE -eq 0)
}

# ── Locate bash ──────────────────────────────────────────────────────────────
$bash = Find-Bash

if (-not $bash) {
    Write-Host ""
    Write-Host "bash not found on this system." -ForegroundColor Yellow
    Write-Host "setup.sh requires bash. Git for Windows ships with one."
    Write-Host ""

    $autoYes = ($ForwardArgs -contains '--yes') -or ($ForwardArgs -contains '-y')
    if ($autoYes) {
        $ans = 'y'
        Write-Host "(--yes flag set: installing Git for Windows without prompt)"
    } else {
        $ans = Read-Host "Install Git for Windows now via winget? [y/N]"
    }

    if ($ans -match '^(y|Y)') {
        if (-not (Install-GitViaWinget)) {
            Write-Error "Git install failed. Install manually and re-run."
            exit 1
        }
        # Re-locate after install (PATH may not be refreshed in this session).
        $bash = Find-Bash
        if (-not $bash) {
            Write-Host ""
            Write-Host "Git installed, but bash is still not on this session's PATH." -ForegroundColor Yellow
            Write-Host "Open a NEW PowerShell window and re-run .\setup.ps1"
            exit 1
        }
    } else {
        Write-Host "Install Git for Windows, WSL, or MSYS, then re-run .\setup.ps1" -ForegroundColor Yellow
        exit 1
    }
}

# ── Invoke setup.sh ──────────────────────────────────────────────────────────
$setupSh = Join-Path $PSScriptRoot 'setup.sh'
if (-not (Test-Path $setupSh)) {
    Write-Error "setup.sh not found alongside setup.ps1 (expected at: $setupSh)"
    exit 1
}

Write-Host ""
Write-Host "Using bash: $bash" -ForegroundColor Cyan
Write-Host "Running:    $setupSh $($ForwardArgs -join ' ')" -ForegroundColor Cyan
Write-Host ""

if ($bash -eq 'WSL') {
    # Translate Windows path to WSL path (C:\foo\bar -> /mnt/c/foo/bar)
    $wslPath = (& wsl.exe wslpath -a "$setupSh").Trim()
    & wsl.exe bash $wslPath @ForwardArgs
} else {
    & $bash $setupSh @ForwardArgs
}

exit $LASTEXITCODE
