# Pruebas del backend

Este directorio contiene dos tipos de pruebas:

| Tipo | Herramienta | Carpeta | Necesita BD |
|------|-------------|---------|-------------|
| Pruebas unitarias y de rutas | Vitest + Supertest | `tests/unit/` | No (los modelos se simulan) |
| Prueba de saturación | Autocannon | `tests/saturacion/` | Sí (PostgreSQL con datos semilla) |

## 1. Pruebas unitarias (Vitest)

Desde `backend/`:

```bash
npm test                # ejecuta todas las pruebas una vez
npm run test:watch      # modo observador mientras desarrollas
npm run test:coverage   # con reporte de cobertura (carpeta coverage/)
```

No requieren base de datos ni archivo `.env`: `tests/setup.js` define las variables mínimas
(`JWT_SECRET`, etc.) y cada prueba simula las consultas de Sequelize.

### Qué se prueba

| Archivo | Cubre |
|---------|-------|
| `middlewares.test.js` | Validación del JWT (ausente, mal formado, firma ajena, expirado, válido) y control de roles |
| `auth.controller.test.js` | Login: validaciones, cuenta desactivada/bloqueada, 3 intentos fallidos → bloqueo de 24 h, token y respuesta sin contraseña |
| `usuario.controller.test.js` | Crear/editar/desactivar usuarios, política de contraseñas, cifrado con bcrypt, reglas por rol |
| `insumo.controller.test.js` | Listado, búsqueda (parametrizada), QR, creación por lotes con códigos `INS-FAM-###`, edición, baja con foto, reasignación |
| `movimientos.controller.test.js` | Entrega, recogida, historial, daño/pérdida con evidencias |
| `ambulancia-centros.controller.test.js` | CRUD de ambulancias y centros asistenciales, reglas de eliminación |
| `reportes.controller.test.js` | Filtros de reportes y que los valores del usuario viajen como parámetros SQL (no concatenados) |
| `app.routes.test.js` | Rutas completas por HTTP: 401 sin token, 403 por rol, rutas públicas, flujo login → ruta protegida, errores 500, CORS |

Cobertura al momento de escribir esto: **~91,6 % de líneas** en `app.js`, controladores, middlewares,
rutas, modelos y la configuración de multer (`config/upload.js`, `config/uploadEvidencia.js`).

### Cobertura para SonarCloud

La configuración del análisis está en `sonar-project.properties` (raíz del repo). Qué cuenta para la
cobertura se define en `vitest.config.mjs` (`coverage.include` / `coverage.exclude`) y debe coincidir con
`sonar.coverage.exclusions`; cada exclusión tiene su motivo comentado en ambos archivos.

1. Generar la cobertura (desde `backend/`):

   ```bash
   npm run test:coverage:sonar
   ```

   Corre las pruebas con cobertura y luego `scripts/fix-lcov-paths.mjs`, que reescribe las rutas `SF:` de
   `coverage/lcov.info` para que queden relativas a la raíz del repo (`backend/src/app.js`, con `/`) y
   comprueba que cada una existe en disco. Si alguna no existe, termina con código 1.

2. Ejecutar el escáner (desde la **raíz** del repo). El token se pasa como variable de entorno,
   nunca en un archivo:

   ```bash
   # macOS / Linux / Git Bash
   export SONAR_TOKEN=<tu-token>
   npx @sonar/scan

   # Windows PowerShell
   $env:SONAR_TOKEN="<tu-token>"; npx @sonar/scan
   ```

   Antes del primer análisis completa `sonar.projectKey` y `sonar.organization` en `sonar-project.properties`.

### Bug conocido documentado

`insumo.controller.js` (`siguienteContador`) usa sintaxis de SQL Server (`[valor]`, `WITH (UPDLOCK)`),
resto de la migración a PostgreSQL. Contra una base PostgreSQL real, `POST /api/insumos`
responde **500** (`syntax error at or near "["`). La prueba marcada `it.fails` lo documenta:
pasa mientras el bug exista y se pondrá en rojo cuando se corrija (entonces cambia `it.fails` por `it`).

## 2. Prueba de saturación

Sube la concurrencia por etapas (10 → 25 → 50 → 100 → 200 → 400 conexiones) sobre 5 endpoints
y marca como **saturado** el primer nivel donde hay más de 1 % de errores o la latencia p99
supera 2000 ms. El criterio de aprobación es soportar **25 conexiones simultáneas**
(el sistema tiene 20 ambulancias + 2 administradores).

> ⚠️ Úsala siempre contra una base de **pruebas**, nunca contra producción (Render).

### Pasos

1. Tener PostgreSQL con la base inicializada: `npm run db:init` y `npm run db:seed-admin`.
2. Arrancar el servidor en otra terminal: `npm start`.
3. Ejecutar la prueba:

```bash
# macOS / Linux / Git Bash
SAT_URL=http://localhost:4000 npm run test:saturacion

# Windows PowerShell
$env:SAT_URL="http://localhost:4000"; npm run test:saturacion
```

Variables opcionales: `SAT_USER`, `SAT_PASS`, `SAT_DURATION` (segundos por etapa, 8 por defecto),
`SAT_STAGES`, `SAT_LOGIN_STAGES`, `SAT_MAX_ERROR_PCT`, `SAT_MAX_P99_MS`, `SAT_TARGET_CONN`.
El detalle de cada corrida queda en `tests/saturacion/resultados/` (no se sube a git).
Código de salida: `0` cumple, `1` no cumple, `2` no se pudo ejecutar.

### Resultados de la corrida de referencia

Entorno: 2 vCPU compartidas entre el servidor, PostgreSQL 16 y el generador de carga
(las cifras son conservadoras; en tu equipo pueden variar, lo importante es la forma de la curva).
Base con 313 insumos, 22 usuarios.

| Endpoint | Máx. req/s | Saturación | Observación |
|----------|-----------:|-----------:|-------------|
| `GET /api/health` | ~5 900 | no (hasta 400) | Línea base sin BD |
| `GET /api/centros-asistenciales` | ~1 450 | no (hasta 400) | Lectura simple |
| `GET /api/reportes/admin/historial` | ~1 250 | no (hasta 400) | SQL pesado, aguanta bien |
| `GET /api/insumos` | ~85 | 50–200 conex. | Devuelve los 313 insumos (≈160 KB) sin paginar |
| `POST /api/auth/login` | **~3** | **5 conex.** | Cuello de botella principal |

**Hallazgo principal: el login bloquea toda la API.** Cada login tarda ~375 ms de CPU
(`bcryptjs`, implementación en JavaScript puro, con costo 12) y se ejecuta en el hilo
principal de Node. Medido con 10 logins simultáneos de fondo, `/api/health` pasó de
5 178 req/s (p99 7 ms) a **4 req/s (p99 4 200 ms)**. En un cambio de turno, donde varias
ambulancias inician sesión a la vez, toda la aplicación se congela unos segundos.

Opciones para mitigarlo (no aplicadas, fuera del alcance de las pruebas):
- Usar el paquete nativo `bcrypt` (corre en el pool de hilos de libuv, no bloquea el event loop).
- Paginar o filtrar `GET /api/insumos` (hoy devuelve todo el inventario en cada petición).
