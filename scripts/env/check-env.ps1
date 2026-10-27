<#
.SYNOPSIS
  Revisa un archivo .env y dice, por variable, si está definida, vacía, con marcador <TU_...> o falta.
  NUNCA muestra los valores.

.DESCRIPTION
  Las variables obligatorias son las que aparecen sin comentar en la plantilla (.example).
  Si no se indica -Template, se usa "<archivo>.example" cuando existe; si no, el propio archivo.
  Sale con código 1 si alguna obligatoria está vacía, con marcador o falta.

.EXAMPLE
  .\scripts\env\check-env.ps1 backend\.env
  .\scripts\env\check-env.ps1 .env .env.prod.example
#>
param(
  [Parameter(Mandatory = $true, Position = 0)] [string] $Path,
  [Parameter(Position = 1)] [string] $Template
)

$ErrorActionPreference = 'Stop'

# Lee KEY=VALUE ignorando comentarios y líneas vacías. Devuelve un diccionario ordenado.
function Read-EnvFile([string] $File) {
  $vars = [ordered]@{}
  foreach ($line in Get-Content -LiteralPath $File -Encoding UTF8) {
    $t = $line.Trim()
    if ($t -eq '' -or $t.StartsWith('#')) { continue }
    if ($t.StartsWith('export ')) { $t = $t.Substring(7).Trim() }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { continue }
    $key = $t.Substring(0, $i).Trim()
    $val = $t.Substring($i + 1).Trim()
    if ($val.Length -ge 2 -and (($val[0] -eq '"' -and $val[-1] -eq '"') -or ($val[0] -eq "'" -and $val[-1] -eq "'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $vars[$key] = $val
  }
  return $vars
}

if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
  Write-Host "[env] No existe el archivo: $Path" -ForegroundColor Red
  exit 2
}
if (-not $Template) {
  if ($Path -like '*.example') { $Template = $Path }
  elseif (Test-Path -LiteralPath "$Path.example" -PathType Leaf) { $Template = "$Path.example" }
  else { $Template = $Path }
}
if (-not (Test-Path -LiteralPath $Template -PathType Leaf)) {
  Write-Host "[env] No existe la plantilla: $Template" -ForegroundColor Red
  exit 2
}

$actual = Read-EnvFile $Path
$requeridas = Read-EnvFile $Template
$errores = 0

Write-Host "[env] Archivo: $Path   Plantilla: $Template"
foreach ($key in $requeridas.Keys) {
  if (-not $actual.Contains($key)) {
    $estado = 'falta en el archivo'; $color = 'Red'; $errores++
  } elseif ($actual[$key] -eq '') {
    $estado = 'vacía'; $color = 'Red'; $errores++
  } elseif ($actual[$key] -match '<TU_[A-Za-z0-9_]*>') {
    $estado = 'sigue con marcador <TU_...>'; $color = 'Yellow'; $errores++
  } else {
    $estado = 'definida'; $color = 'Green'
  }
  Write-Host ('  {0,-22} {1}' -f $key, $estado) -ForegroundColor $color
}
foreach ($key in $actual.Keys) {
  if (-not $requeridas.Contains($key)) {
    Write-Host ('  {0,-22} definida (no está en la plantilla)' -f $key) -ForegroundColor DarkGray
  }
}

if ($errores -gt 0) {
  Write-Host "[env] $errores variable(s) obligatoria(s) sin un valor real." -ForegroundColor Red
  exit 1
}
Write-Host '[env] Todas las variables obligatorias tienen valor.' -ForegroundColor Green
exit 0
