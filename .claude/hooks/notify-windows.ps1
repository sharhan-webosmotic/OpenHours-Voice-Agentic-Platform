# notify-windows.ps1 — Windows toast notification for ADF (v3.8).
#
# Usage: notify-windows.ps1 "<title>" "<message>"
#
# Prefers the BurntToast module (clean, reliable, Action Center-aware).
# Falls back to raw Windows.UI.Notifications for users who don't have
# BurntToast installed.
#
# Called by hooks/notify.sh via:
#   powershell -NoProfile -ExecutionPolicy Bypass -File notify-windows.ps1 TITLE MSG

param(
  [Parameter(Mandatory=$true, Position=0)][string]$Title = "Claude Code",
  [Parameter(Mandatory=$true, Position=1)][string]$Message = ""
)

$ErrorActionPreference = 'SilentlyContinue'

# ── Path A: BurntToast (preferred) ────────────────────────────────────────────
if (Get-Module -ListAvailable -Name BurntToast) {
  try {
    New-BurntToastNotification -Text $Title, $Message -AppLogo $null | Out-Null
    exit 0
  } catch {
    # Fall through to raw API path.
  }
}

# ── Path B: raw Windows.UI.Notifications ──────────────────────────────────────
# Works without installing anything but is sensitive to subprocess context.
try {
  [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
  [void][Windows.UI.Notifications.ToastNotification,        Windows.UI.Notifications, ContentType = WindowsRuntime]
  [void][Windows.Data.Xml.Dom.XmlDocument,                   Windows.Data.Xml.Dom,       ContentType = WindowsRuntime]

  $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(
    [Windows.UI.Notifications.ToastTemplateType]::ToastText02
  )

  $textNodes = $template.GetElementsByTagName('text')
  [void]$textNodes.Item(0).AppendChild($template.CreateTextNode($Title))
  [void]$textNodes.Item(1).AppendChild($template.CreateTextNode($Message))

  $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
  $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Claude Code')
  $notifier.Show($toast)
  exit 0
} catch {
  # Last-resort fallback: balloon tip via WinForms (works in almost every context).
  try {
    Add-Type -AssemblyName System.Windows.Forms
    $icon = New-Object System.Windows.Forms.NotifyIcon
    $icon.Icon = [System.Drawing.SystemIcons]::Information
    $icon.BalloonTipTitle = $Title
    $icon.BalloonTipText  = $Message
    $icon.Visible = $true
    $icon.ShowBalloonTip(5000)
    Start-Sleep -Milliseconds 500
    $icon.Dispose()
  } catch {
    # Give up silently — notifications are best-effort.
  }
}

exit 0
