<#
.SYNOPSIS
  Carga las variables de .env.sonar en la ventana actual de PowerShell (solo en esa sesión).
  NUNCA muestra los valores.

.DESCRIPTION
  Lee el archivo real .env.sonar (no el .example) de la raíz del repo, o el indicado con -Path.
  No modifica las variables de entorno de Windows: al cerrar la ventana desaparecen.
  Las variables que siguen con marcador <TU_...> o vacías no se cargan.
  Si SONAR_TOKEN no queda definido, avisa y sale con código 1.

.EXAMPLE
  .\scripts\env\load-sonar-env.ps1
  .\scripts\env\load-sonar-env.ps1 -Path C:\ruta\a\.env.sonar
#>
param(
  [string] $Path = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) '.env.sonar')
)

$ErrorActionPreference = 'Stop'

if ($Path -like '*.example') {
  Write-Host '[sonar] Ese es el archivo de plantilla. Copia .env.sonar.example como .env.sonar y llénalo.' -ForegroundColor Red
  exit 1
}
if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
  Write-Host "[sonar] No existe $Path. Crea el archivo con: copy .env.sonar.example .env.sonar" -ForegroundColor Red
  exit 1
}

foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
  $t = $line.Trim()
  if ($t -eq '' -or $t.StartsWith('#')) { continue }
  $i = $t.IndexOf('=')
  if ($i -lt 1) { continue }
  $key = $t.Substring(0, $i).Trim()
  $val = $t.Substring($i + 1).Trim()
  if ($val.Length -ge 2 -and (($val[0] -eq '"' -and $val[-1] -eq '"') -or ($val[0] -eq "'" -and $val[-1] -eq "'"))) {
    $val = $val.Substring(1, $val.Length - 2)
  }
  if ($val -eq '') {
    Write-Host "  $key  vacía: no se carga" -ForegroundColor Yellow
  } elseif ($val -match '<TU_[A-Za-z0-9_]*>') {
    Write-Host "  $key  sigue con marcador <TU_...>: no se carga" -ForegroundColor Yellow
  } else {
    # Ámbito de proceso: solo esta ventana de PowerShell y los programas que lance
    [Environment]::SetEnvironmentVariable($key, $val, 'Process')
    Write-Host "  $key  cargada" -ForegroundColor Green
  }
}

if (-not $env:SONAR_TOKEN) {
  Write-Host '[sonar] SONAR_TOKEN no está definido. El escáner no podrá autenticarse.' -ForegroundColor Red
  exit 1
}
Write-Host '[sonar] Listo. Las variables solo existen en esta ventana.' -ForegroundColor Green
