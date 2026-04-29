param(
  [string]$BaseUrl = "http://localhost:8080"
)

$ErrorActionPreference = "Stop"
$previousAdminCode = $env:ADMIN_CODE
$previousCookieSecret = $env:COOKIE_SECRET
$adminCode = if ([string]::IsNullOrWhiteSpace($env:ADMIN_CODE)) { "smoke-admin-code" } else { $env:ADMIN_CODE }
$cookieSecret = if ([string]::IsNullOrWhiteSpace($env:COOKIE_SECRET)) { "smoke-cookie-secret" } else { $env:COOKIE_SECRET }

$env:ADMIN_CODE = $adminCode
$env:COOKIE_SECRET = $cookieSecret

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "docker is required to run this smoke test."
}

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  if (Test-Path ".localdata") {
    Remove-Item -Recurse -Force ".localdata"
  }

  docker compose down --remove-orphans | Out-Null
  docker compose up -d --build | Out-Null

  $admin = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $adminLoginBody = @{ adminCode = $adminCode } | ConvertTo-Json -Compress
  Invoke-WebRequest -Uri "$BaseUrl/api/admin/login" -Method POST -ContentType "application/json" -Body $adminLoginBody -WebSession $admin | Out-Null

  $sessionName = "Docker Smoke $([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
  $sessionRes = Invoke-WebRequest -Uri "$BaseUrl/api/admin/sessions" -Method POST -ContentType "application/json" -Body "{`"name`":`"$sessionName`",`"pointsPerTeam`":5,`"judgePoints`":15}" -WebSession $admin
  $sessionId = ($sessionRes.Content | ConvertFrom-Json).session.id

  Invoke-WebRequest -Uri "$BaseUrl/api/admin/sessions/$sessionId/teams" -Method POST -ContentType "application/json" -Body '{"name":"Alpha","password":"alpha-pass"}' -WebSession $admin | Out-Null
  Invoke-WebRequest -Uri "$BaseUrl/api/admin/sessions/$sessionId/teams" -Method POST -ContentType "application/json" -Body '{"name":"Bravo","password":"bravo-pass"}' -WebSession $admin | Out-Null

  docker compose restart voting | Out-Null
  Start-Sleep -Seconds 3

  $sessions = Invoke-WebRequest -Uri "$BaseUrl/api/admin/sessions" -WebSession $admin
  if ($sessions.Content -notmatch [regex]::Escape($sessionName)) {
    throw "Session data was not preserved after container restart."
  }

  Write-Host "Docker persistence smoke passed."
}
finally {
  docker compose down --remove-orphans | Out-Null
  if ($null -eq $previousAdminCode) {
    Remove-Item Env:ADMIN_CODE -ErrorAction SilentlyContinue
  } else {
    $env:ADMIN_CODE = $previousAdminCode
  }
  if ($null -eq $previousCookieSecret) {
    Remove-Item Env:COOKIE_SECRET -ErrorAction SilentlyContinue
  } else {
    $env:COOKIE_SECRET = $previousCookieSecret
  }
  Pop-Location
}
