# Starts the dashboard (npm run dev) when Claude Code opens this project,
# unless it's already running on port 5173.
$url = 'http://localhost:5173'
if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) {
  $msg = "Dashboard already running at $url"
} else {
  Start-Process cmd.exe -ArgumentList '/k', 'npm run dev' -WorkingDirectory (Split-Path $PSScriptRoot) -WindowStyle Minimized
  $msg = "Started the dashboard at $url (minimized window; close it to stop)"
}
@{ systemMessage = $msg } | ConvertTo-Json -Compress
