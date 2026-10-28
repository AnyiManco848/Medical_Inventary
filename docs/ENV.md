# Variables de entorno

Cada entorno tiene una plantilla `*.example` versionada. Los archivos reales (`.env`, `.env.local`,
`.env.prod`, `.env.sonar`...) están en `.gitignore` y **nunca** se suben al repositorio.
Los valores que debes reemplazar aparecen como marcadores `<TU_...>`.

## Qué archivo copiar

| Entorno | Plantilla | Copia como | Comando (Windows · bash) |
|---|---|---|---|
| Backend local | `backend/.env.example` | `backend/.env` | `copy backend\.env.example backend\.env` · `cp backend/.env.example backend/.env` |
| Frontend local | `frontend/.env.local.example` | `frontend/.env.local` | `copy frontend\.env.local.example frontend\.env.local` · `cp frontend/.env.local.example frontend/.env.local` |
| SonarQube Cloud | `.env.sonar.example` | `.env.sonar` (opcional, ver abajo) | `copy .env.sonar.example .env.sonar` |

Las variables de producción se documentarán con el despliegue.

> `docker-compose.yml` (Docker local) lee `DB_USER`, `DB_PASSWORD` y `JWT_SECRET` de un archivo `.env` en la
> **raíz** del repo, no de `backend/.env`. Puedes crearlo con esas tres variables tomando los valores de
> `backend/.env`.

## Comprobar que no falta nada (sin mostrar valores)

```powershell
.\scripts\env\check-env.ps1 backend\.env               # compara con backend\.env.example
.\scripts\env\check-env.ps1 frontend\.env.local frontend\.env.local.example   # plantilla explícita
```

```bash
scripts/env/check-env.sh backend/.env
```

Por cada variable dice `definida`, `vacía`, `sigue con marcador <TU_...>` o `falta en el archivo`.
Sale con código 1 si alguna obligatoria (las que están sin comentar en la plantilla) no tiene un valor real.

## Variables secretas

| Variable | Dónde se consigue |
|---|---|
| `DB_PASSWORD` | La que definiste al instalar PostgreSQL, o genera una nueva para producción |
| `DATABASE_URL` | Panel del proveedor de la base (Neon, RDS, Render...). Contiene usuario y contraseña |
| `JWT_SECRET` | Genérala tú (comandos abajo). Si cambia, se cierran todas las sesiones |
| `SONAR_TOKEN` | SonarQube Cloud > My Account > Security > Generate Tokens |
| `SAT_PASS` | Contraseña de un administrador de la base de **pruebas** (solo prueba de saturación) |

Para generar `JWT_SECRET` o `DB_PASSWORD` (en hexadecimal, así no hay caracteres que Docker Compose interprete):

```bash
openssl rand -hex 32
```

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | % { $_.ToString('x2') })
```

Sin openssl ni PowerShell: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

## SONAR_TOKEN como variable de usuario de Windows

Así el token no vive en ningún archivo del repo y lo ven todas las terminales nuevas:

1. Menú Inicio > busca **"Editar las variables de entorno de esta cuenta"**.
2. En *Variables de usuario*, pulsa **Nueva...**: nombre `SONAR_TOKEN`, valor: tu token.
3. Acepta y **cierra y vuelve a abrir** las terminales (y Claude Code / VS Code) para que la vean.
4. Comprueba sin mostrar el valor: `[bool]$env:SONAR_TOKEN` debe decir `True`.

Alternativa solo para una ventana: copia `.env.sonar.example` como `.env.sonar`, llénalo y ejecuta
`.\scripts\env\load-sonar-env.ps1`. Las variables desaparecen al cerrar la ventana.

## Inventario de variables

| Variable | Usada en | Secreta | Por defecto | Entorno |
|---|---|---|---|---|
| `PORT` | `backend/src/index.js` | No | `4000` | Backend local, producción |
| `NODE_ENV` | `backend/src/app.js`, `config/database.js`, `index.js` | No | sin valor (se trata como desarrollo) | Backend local, producción |
| `FRONTEND_URL` | `backend/src/app.js` (CORS) | No | `http://localhost:3000` | Backend local, producción |
| `DATABASE_URL` | `backend/src/config/database.js`, `initDB.js` | **Sí** | — | Backend en la nube |
| `DB_SSL_REJECT_UNAUTHORIZED` | `backend/src/config/database.js` (solo con `DATABASE_URL`) | No | `false` (cifra pero **no verifica** el certificado del servidor) | Backend en la nube. `true` verifica el certificado SSL |
| `DB_HOST` / `DB_PORT` / `DB_NAME` | `config/database.js`, `initDB.js`, `seedInsumos.js` | No | `localhost` / `5432` / `MedicalInventary` | Backend local, producción Docker |
| `DB_USER` | Ídem, `docker-compose.yml` | No | — | Backend local, Docker |
| `DB_PASSWORD` | Ídem, `docker-compose.yml` | **Sí** | — | Backend local, Docker |
| `JWT_SECRET` | `controllers/auth.controller.js`, `middlewares/auth.middleware.js`, `docker-compose.yml` | **Sí** | — (sin él el login falla) | Backend local, producción |
| `JWT_EXPIRES_IN` | `controllers/auth.controller.js` | No | `8h` en compose | Backend local, producción |
| `AUTO_INIT` | `backend/src/index.js` | No | `false` | Producción Docker |
| `NEXT_PUBLIC_API_URL` | 11 archivos de `frontend/app/` | No (pública) | `http://localhost:4000` | Frontend (build) |
| `SONAR_TOKEN` | escáner de Sonar | **Sí** | — | Sonar |
| `SONAR_HOST_URL` | escáner de Sonar | No | `https://sonarcloud.io` | Sonar |
| `SAT_URL`, `SAT_USER`, `SAT_PASS`, `SAT_*` | `backend/tests/saturacion/saturacion.js` | `SAT_PASS` sí | ver `backend/tests/README.md` | Prueba de saturación |
| `DB_ENCRYPT`, `DB_TRUST_CERT`, `DB_INSTANCE` | solo `backend/src/config/seedInsumos.js` | No | — | Obsoletas: de la época de SQL Server; no se documentan en las plantillas |

Las variables de producción se documentarán con el despliegue.
