#!/usr/bin/env bash
# Revisa un archivo .env y dice, por variable, si está definida, vacía, con marcador <TU_...> o falta.
# NUNCA muestra los valores.
#
# Las variables obligatorias son las que aparecen sin comentar en la plantilla (.example).
# Si no se indica plantilla, se usa "<archivo>.example" cuando existe; si no, el propio archivo.
# Sale con código 1 si alguna obligatoria está vacía, con marcador o falta (2 si no existe el archivo).
#
# Uso: scripts/env/check-env.sh backend/.env
#      scripts/env/check-env.sh .env .env.prod.example
set -euo pipefail

archivo="${1:-}"
plantilla="${2:-}"

if [[ -z "$archivo" ]]; then
  echo "Uso: $0 <archivo.env> [plantilla.example]" >&2
  exit 2
fi
if [[ ! -f "$archivo" ]]; then
  echo "[env] No existe el archivo: $archivo" >&2
  exit 2
fi
if [[ -z "$plantilla" ]]; then
  if [[ "$archivo" == *.example ]]; then plantilla="$archivo"
  elif [[ -f "$archivo.example" ]]; then plantilla="$archivo.example"
  else plantilla="$archivo"
  fi
fi
if [[ ! -f "$plantilla" ]]; then
  echo "[env] No existe la plantilla: $plantilla" >&2
  exit 2
fi

# Lee KEY=VALUE ignorando comentarios y líneas vacías; llena el arreglo asociativo indicado.
leer_env() {
  local -n destino="$1"
  local -n orden="$2"
  local linea clave valor
  while IFS= read -r linea || [[ -n "$linea" ]]; do
    linea="${linea%$'\r'}"
    linea="${linea#"${linea%%[![:space:]]*}"}"
    [[ -z "$linea" || "$linea" == \#* ]] && continue
    linea="${linea#export }"
    [[ "$linea" != *=* ]] && continue
    clave="${linea%%=*}"
    clave="${clave%"${clave##*[![:space:]]}"}"
    [[ -z "$clave" ]] && continue
    valor="${linea#*=}"
    valor="${valor#"${valor%%[![:space:]]*}"}"
    valor="${valor%"${valor##*[![:space:]]}"}"
    if [[ ${#valor} -ge 2 && ( ( "${valor:0:1}" == '"' && "${valor: -1}" == '"' ) || ( "${valor:0:1}" == "'" && "${valor: -1}" == "'" ) ) ]]; then
      valor="${valor:1:${#valor}-2}"
    fi
    [[ -z "${destino[$clave]+x}" ]] && orden+=("$clave")
    destino["$clave"]="$valor"
  done < "$3"
}

declare -A actual=() requeridas=()
declare -a orden_actual=() orden_requeridas=()
leer_env actual orden_actual "$archivo"
leer_env requeridas orden_requeridas "$plantilla"

errores=0
echo "[env] Archivo: $archivo   Plantilla: $plantilla"
for clave in "${orden_requeridas[@]}"; do
  if [[ -z "${actual[$clave]+x}" ]]; then
    estado="falta en el archivo"; errores=$((errores + 1))
  elif [[ -z "${actual[$clave]}" ]]; then
    estado="vacía"; errores=$((errores + 1))
  elif [[ "${actual[$clave]}" =~ \<TU_[A-Za-z0-9_]*\> ]]; then
    estado="sigue con marcador <TU_...>"; errores=$((errores + 1))
  else
    estado="definida"
  fi
  printf '  %-22s %s\n' "$clave" "$estado"
done
for clave in "${orden_actual[@]}"; do
  [[ -z "${requeridas[$clave]+x}" ]] && printf '  %-22s %s\n' "$clave" "definida (no está en la plantilla)"
done

if (( errores > 0 )); then
  echo "[env] $errores variable(s) obligatoria(s) sin un valor real." >&2
  exit 1
fi
echo "[env] Todas las variables obligatorias tienen valor."
