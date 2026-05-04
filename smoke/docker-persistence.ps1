param(
  [string]$BaseUrl = "http://localhost:8080"
)

$ErrorActionPreference = "Stop"
$previousAdminCode = $env:ADMIN_CODE
$previousCookieSecret = $env:COOKIE_SECRET
$previousPostgresPassword = $env:POSTGRES_PASSWORD
$adminCode = if ([string]::IsNullOrWhiteSpace($env:ADMIN_CODE)) { "smoke-admin-code" } else { $env:ADMIN_CODE }
$cookieSecret = if ([string]::IsNullOrWhiteSpace($env:COOKIE_SECRET)) { "smoke-cookie-secret" } else { $env:COOKIE_SECRET }
$postgresPassword = if ([string]::IsNullOrWhiteSpace($env:POSTGRES_PASSWORD)) { "smoke-postgres-password" } else { $env:POSTGRES_PASSWORD }

$env:ADMIN_CODE = $adminCode
$env:COOKIE_SECRET = $cookieSecret
$env:POSTGRES_PASSWORD = $postgresPassword

function Wait-ForHealth {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      Invoke-WebRequest -Uri "$Url/api/health" -TimeoutSec 5 | Out-Null
      return
    } catch {
      Start-Sleep -Seconds 2
    }
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for $Url/api/health"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "docker is required to run this smoke test."
}

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  docker compose down --remove-orphans --volumes | Out-Null
  docker compose up -d --build | Out-Null
  Wait-ForHealth -Url $BaseUrl

  $admin = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $adminLoginBody = @{ adminCode = $adminCode } | ConvertTo-Json -Compress
  Invoke-WebRequest -Uri "$BaseUrl/api/admin/login" -Method POST -ContentType "application/json" -Body $adminLoginBody -WebSession $admin | Out-Null

  $sessionName = "Docker Smoke $([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
  $sessionRes = Invoke-WebRequest -Uri "$BaseUrl/api/admin/sessions" -Method POST -ContentType "application/json" -Body "{`"name`":`"$sessionName`",`"pointsPerTeam`":5,`"judgePoints`":15}" -WebSession $admin
  $sessionId = ($sessionRes.Content | ConvertFrom-Json).session.id

  Invoke-WebRequest -Uri "$BaseUrl/api/admin/sessions/$sessionId/teams" -Method POST -ContentType "application/json" -Body '{"name":"Alpha","password":"alpha-pass"}' -WebSession $admin | Out-Null
  Invoke-WebRequest -Uri "$BaseUrl/api/admin/sessions/$sessionId/teams" -Method POST -ContentType "application/json" -Body '{"name":"Bravo","password":"bravo-pass"}' -WebSession $admin | Out-Null

  docker compose restart voting | Out-Null
  Wait-ForHealth -Url $BaseUrl

  $sessions = Invoke-WebRequest -Uri "$BaseUrl/api/admin/sessions" -WebSession $admin
  if ($sessions.Content -notmatch [regex]::Escape($sessionName)) {
    throw "Session data was not preserved after container restart."
  }

  Write-Host "Docker persistence smoke passed."
}
finally {
  docker compose down --remove-orphans --volumes | Out-Null
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
  if ($null -eq $previousPostgresPassword) {
    Remove-Item Env:POSTGRES_PASSWORD -ErrorAction SilentlyContinue
  } else {
    $env:POSTGRES_PASSWORD = $previousPostgresPassword
  }
  Pop-Location
}
