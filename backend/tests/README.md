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
| `app.errores.test.js` | Manejador de errores de `app.js` (status propio, mensaje por defecto, stack solo en desarrollo, errores de multer) y subida real de un archivo no permitido |
| `controladores.ramas.test.js` | Ramas restantes de los controladores: validaciones, 404/409, valores por defecto y que los errores inesperados lleguen a `next()` |
| `upload.config.test.js` | Configuración de multer (`config/upload.js` y `config/uploadEvidencia.js`): límites de tamaño, extensiones y tipos MIME, carpeta destino y nombre de archivo |
| `database.config.test.js` | `config/database.js` con Sequelize simulado: `DATABASE_URL` (SSL, `DB_SSL_REJECT_UNAUTHORIZED`) o variables `DB_*`, valores por defecto, puerto inválido, logging |
| `models.test.js` | `models/index.js`: modelos exportados, instancia compartida de Sequelize y cada asociación (tipo, destino y clave foránea) |

Cobertura actual (`npm run test:coverage`): **100 % de líneas, 98,9 % de ramas, 100 % de funciones** en
`app.js`, controladores, middlewares, rutas, modelos y la configuración de multer y de la base de datos.
`vitest.config.mjs` exige un mínimo de 80 % en líneas, ramas, funciones y sentencias (`coverage.thresholds`):
si la cobertura baja de ahí, `npm run test:coverage` falla.

Las 5 ramas sin cubrir no se pueden alcanzar: la rama implícita «sin `else`» que v8 cuenta en `app.js:48`,
`usuario.controller.js:151` e `insumo.controller.js:472`; la rama de `deleteFile` sin ruta en
`insumo.controller.js:13`, y en el `catch` de `darDeBaja` (`insumo.controller.js:319`) el caso «sin foto», porque
la validación ya rechaza antes cualquier petición sin foto.

### Fallos corregidos

Estos errores estaban documentados con `it.fails` y ya se corrigieron; sus pruebas ahora comprueban el
comportamiento correcto. Hoy no queda ninguna prueba `it.fails`. Si en el futuro se agrega una para
documentar un fallo, Vitest la cuenta como «expected fail»; cuando se corrija, empezará a pasar, Vitest lo
marcará como error y habrá que quitarle el `.fails`.

| Fallo | Corrección | Pruebas |
|-------|-----------|---------|
| El rol ambulancia podía crear, editar, eliminar, dar de baja y reasignar insumos | `routes/insumo.routes.js`: `verificarRol('admin')` en todas las rutas de escritura (en la baja, antes de multer) | `app.errores.test.js` · control de acceso por rol |
| Un archivo demasiado grande respondía 500 «File too large» | `app.js`: `LIMIT_FILE_SIZE` → 413 con mensaje en español | `app.errores.test.js` · manejador global |
| `crearDanoPerdida` dejaba fotos huérfanas al responder 400/404 o fallar | Borra las fotos subidas; un fallo al borrar solo se registra | `controladores.ramas.test.js` |
| Un `motivo` que no es texto en `darDeBaja` daba 500 | Responde 400 y borra la foto | `controladores.ramas.test.js` |

### Cobertura para SonarCloud

La configuración del análisis está en `sonar-project.properties` (raíz del repo). Qué cuenta para la
cobertura se define en `vitest.config.mjs` (`coverage.include` / `coverage.exclude`) y debe coincidir con
`sonar.coverage.exclusions`; cada exclusión tiene su motivo comentado en ambos archivos.

1. Generar la cobertura de backend **y** frontend (desde la **raíz** del repo):

   ```bash
   npm run coverage:sonar
   ```

   Corre `test:coverage` en `backend/` y en `frontend/` y luego `scripts/fix-lcov-paths.mjs` (en la raíz),
   que reescribe las rutas `SF:` de `backend/coverage/lcov.info` y `frontend/coverage/lcov.info` para que
   queden relativas a la raíz del repo (`backend/src/app.js`, `frontend/app/login/page.js`, con `/`) y
   comprueba que cada una existe en disco y está dentro de `backend/src/` o `frontend/app/`. Si alguna
   falla, termina con código 1. Es idempotente: `npm run lcov:check` lo vuelve a correr solo como chequeo.

   Solo el backend (desde `backend/`): `npm run test:coverage:sonar`.

2. Ejecutar el escáner (desde la **raíz** del repo). El token se pasa como variable de entorno,
   nunca en un archivo:

   ```bash
   # macOS / Linux / Git Bash
   export SONAR_TOKEN=<tu-token>
   npx @sonar/scan

   # Windows PowerShell
   $env:SONAR_TOKEN="<tu-token>"; npx @sonar/scan
   ```

   `sonar.projectKey` y `sonar.organization` ya están configurados en `sonar-project.properties`.

### Bug corregido: contador de códigos

`insumo.controller.js` (`siguienteContador`) usaba sintaxis de SQL Server (`[valor]`, `WITH (UPDLOCK)`),
resto de la migración a PostgreSQL: contra una base real, `POST /api/insumos` respondía **500**
(`syntax error at or near "["`). Ahora usa `SELECT ... FOR UPDATE` dentro de la transacción.
La prueba «el SQL del contador es compatible con PostgreSQL» evita que vuelva a aparecer.
Pendiente: verificarlo contra un PostgreSQL real (las pruebas simulan Sequelize).

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
