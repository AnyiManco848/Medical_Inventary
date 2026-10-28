# Integración continua (CI/CD)

El pipeline está en [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml). Corre en cada
**push a `main`** (incluye el merge de un PR) y en cada **pull request hacia `main`**.

## Qué hace cada job

| Job | Qué hace |
|-----|----------|
| **🧪 Unit Tests** (`test`) | Node 24 con caché de npm. `npm ci` en `backend/` y `frontend/`, y desde la raíz `npm run coverage:sonar`: pruebas con cobertura de los dos proyectos, mínimo de 80 % y validación de las rutas de los dos `lcov.info`. Guarda `backend/coverage/` y `frontend/coverage/` como artefacto **cobertura** (7 días). |
| **🏗 Build Check** (`build`) | Solo si pasaron las pruebas. Construye las imágenes Docker de `backend/` y `frontend/` (sin publicarlas) y compila el frontend con `npm run build`. Usa `NEXT_PUBLIC_API_URL=https://api.example.com`, un valor de prueba solo para compilar. |
| **🔎 Sonar Analysis** (`sonar`) | Solo si pasó el build. Descarga el código con historial completo y el artefacto de cobertura (no repite las pruebas) y ejecuta la acción oficial de SonarSource con `sonar-project.properties`. En push a `main` analiza la rama principal; en un PR, solo si viene del mismo repositorio. Si falta el secreto `SONAR_TOKEN`, se omite con un aviso y **no falla**. |

En un PR, una corrida nueva cancela la anterior. En `main` no se cancela: el segundo merge espera al
primero (GitHub deja solo una corrida en espera; con tres merges muy seguidos, la del medio se cancela).

## Configuración inicial (una sola vez)

1. **Secreto `SONAR_TOKEN`.** En SonarQube Cloud: avatar → **My Account** → **Security** → genera un
   token. En GitHub: **Settings** → **Secrets and variables** → **Actions** → **Secrets** →
   **New repository secret**, nombre `SONAR_TOKEN`. El valor no se escribe en ningún archivo.
2. **Apagar el análisis automático de Sonar.** En SonarQube Cloud: el proyecto → **Administration** →
   **Analysis Method** → desactiva **Automatic Analysis**. Si queda encendido, el análisis desde CI falla.
3. **Proteger `main` (después de la primera corrida,** porque antes los checks no aparecen en la lista).
   **Settings** → **Rules** → **Rulesets** → **New branch ruleset**: target la rama por defecto, activa
   **Require a pull request before merging**, **Require status checks to pass** con **🧪 Unit Tests** y
   **🏗 Build Check** (y **🔎 Sonar Analysis** si activas el Quality Gate), y **Block force pushes**.

## Quality Gate (opcional)

Por defecto el job de Sonar publica el análisis pero no espera el Quality Gate, así que no falla por él.
Para activarlo: **Settings** → **Secrets and variables** → **Actions** → **Variables** →
**New repository variable**, nombre `SONAR_QUALITYGATE_WAIT`, valor `true`. Desde la siguiente corrida
el job espera hasta 5 minutos y falla si el Quality Gate no pasa. Para desactivarlo, borra la variable.

## Correr lo mismo en local

Desde la raíz (Node 22.22+ o 24.15+, dependencias instaladas en `backend/` y `frontend/`):

```bash
npm run coverage:sonar          # job test
cd frontend && npm run build    # parte del job build
```

## Cómo leer un fallo

GitHub → **Actions** → la corrida en rojo → el job y el paso que falló.

| Paso | Qué significa | Qué hacer |
|------|---------------|-----------|
| Instalar dependencias | `package-lock.json` no coincide con `package.json` | `npm install` en esa carpeta y sube el lock actualizado |
| Pruebas con cobertura, `FAIL` | Falló una prueba | El registro muestra archivo, prueba y diferencia; reprodúcelo con `npm test` |
| Pruebas con cobertura, `does not meet global threshold (80%)` | Bajó la cobertura | Agrega pruebas para el código nuevo |
| Pruebas con cobertura, `[lcov] … FALLA` | Una ruta del lcov no existe | Revisa `coverage.include` del `vitest.config.mjs` |
| Construir la imagen Docker | El `Dockerfile` o el build dentro de la imagen falló | Reprodúcelo con `docker build backend` o `docker build frontend` |
| Compilar el frontend | Error de Next.js al compilar | Reprodúcelo con `npm run build` en `frontend/` |
| Analizar con SonarQube Cloud, `Not authorized` / `Project not found` | Token inválido | Regenera el token y actualiza el secreto |
| Analizar con SonarQube Cloud, `Automatic Analysis is enabled` | Falta el paso 2 | Apaga el análisis automático |
| Analizar con SonarQube Cloud, `QUALITY GATE STATUS: FAILED` | Solo con `SONAR_QUALITYGATE_WAIT=true` | Abre el enlace del registro y revisa las condiciones |

Los reportes de cobertura se descargan desde la corrida → **Artifacts** → **cobertura**.
