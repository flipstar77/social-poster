# FlowingPost Blog Agent — Setup Scheduled Task
# Run this once as Administrator:
#   Right-click PowerShell → "Run as Administrator"
#   cd C:\Users\Tobias\social-poster
#   powershell -ExecutionPolicy Bypass -File scripts\blog-agents\setup-schedule.ps1

$taskName = "FlowingPost Blog Agent"
$batPath = "C:\Users\Tobias\social-poster\scripts\blog-agents\run-daily.bat"

# Remove existing task if present
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Create action
$action = New-ScheduledTaskAction -Execute $batPath -WorkingDirectory "C:\Users\Tobias\social-poster"

# Daily at 06:00
$trigger = New-ScheduledTaskTrigger -Daily -At 06:00

# Settings: run whether logged in or not, wake PC, allow on battery
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -WakeToRun `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -StartWhenAvailable

# Register with current user
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType Interactive

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Daily blog article generation via Claude Code (FlowingPost)"

Write-Host ""
Write-Host "Scheduled task '$taskName' created!" -ForegroundColor Green
Write-Host "  Time: Daily at 06:00"
Write-Host "  Script: $batPath"
Write-Host "  Logs: data\pipeline\scheduler-log.txt"
Write-Host ""
Write-Host "To test manually: schtasks /run /tn `"$taskName`""
