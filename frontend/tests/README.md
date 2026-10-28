# Pruebas del frontend

Pruebas de componentes con **Vitest + Testing Library** sobre **jsdom**. Renderizan cada página de
`app/` y la usan como un usuario (clics, formularios, filtros), con el backend simulado: no necesitan el
servidor, la base de datos ni conexión a internet.

## Cómo correrlas

Desde `frontend/`:

```bash
npm test                    # ejecuta todas las pruebas una vez
npm run test:watch          # modo observador mientras desarrollas
npm run test:coverage       # con reporte de cobertura (carpeta coverage/, abre coverage/index.html)
npm run test:coverage:sonar # cobertura + corrección de rutas del lcov para SonarCloud
```

Una sola prueba: `npx vitest run tests/login.test.jsx`.
En un equipo con poca memoria: `npx vitest run --maxWorkers=1`.

## Configuración

| Archivo | Para qué |
|---------|----------|
| `vitest.config.mjs` | Entorno jsdom, alias `@/` (igual que `jsconfig.json`), JSX en archivos `.js`, zona horaria fija `America/Bogota`, cobertura v8 con mínimo de 80 % |
| `tests/setup.js` | Matchers de jest-dom (`toBeInTheDocument`, …), limpieza entre pruebas y APIs que jsdom no trae (canvas, `requestAnimationFrame`, `matchMedia`, `URL.createObjectURL`) |
| `tests/helpers.js` | `crearJWT` / `jwtAdmin` / `jwtAmbulancia` (token con la forma real), `cookiesCon` (simula `js-cookie`) y `rutasGet` (respuesta de `axios.get` según la URL; lo no simulado responde 404) |
| `tests/InsumoSelector.stub.jsx` | Reemplazo simple de `InsumoSelector` para las páginas que lo usan; el componente real se prueba aparte |

Qué se simula en cada prueba: `next/navigation` (con un `router` **estable**, porque las páginas tienen
`useEffect(..., [router])` y un objeto nuevo en cada render provoca un bucle infinito), `next/link`,
`axios`, `js-cookie`, y según la página `html5-qrcode`, `jspdf`, `jspdf-autotable` y `xlsx`.
`window.confirm`, `alert`, `print`, la cámara (`navigator.mediaDevices`) y `BarcodeDetector` se espían o
se definen dentro de la prueba que los necesita.

## Qué se prueba

| Archivo | Página / componente | Cubre |
|---------|---------------------|-------|
| `home.test.jsx` | `app/page.js` | Redirige a `/login` |
| `login.test.jsx` | `app/login/page.js` | Validaciones, login correcto (cookies y redirección), errores del backend, mostrar contraseña, fondo animado |
| `dashboard.test.jsx` | `app/dashboard/page.js` | Sesión, menú según el rol (admin / ambulancia), cerrar sesión |
| `InsumoSelector.test.jsx` | `app/dashboard/_components/InsumoSelector.js` | Autocompletado con debounce, búsqueda por código exacto, lector QR (`html5-qrcode` simulado) y apagado de la cámara |
| `entregar.test.jsx` | `app/dashboard/entregar/page.js` | Fecha y hora propuestas, tripulación, centro «Otro», validaciones, envío y aviso de éxito |
| `recoger.test.jsx` | `app/dashboard/recoger/page.js` | Prellenado desde la última entrega del insumo, validaciones y envío |
| `dano.test.jsx` | `app/dashboard/dano/page.js` | Daño o pérdida con hasta 5 fotos: vista previa, contador del motivo, envío multipart |
| `reportes.test.jsx` | `app/dashboard/reportes/page.js` | «Mis entregas» (solo rol ambulancia): tabla, estado vacío y error |
| `usuarios.test.jsx` | `app/dashboard/usuarios/page.js` | Crear, editar y desactivar usuarios (solo admin), paginación |
| `ambulancias.test.jsx` | `app/dashboard/ambulancias/page.js` | CRUD de ambulancias, búsqueda, filtro por estado, paginación |
| `centros.test.jsx` | `app/dashboard/centros/page.js` | CRUD de centros, búsqueda, modal de insumos del centro |
| `reportes-admin.test.jsx` | `app/dashboard/reportes-admin/page.js` | Historial y pendientes con filtros, paginación y exportación a PDF/Excel |
| `inventario.test.jsx` | `app/dashboard/inventario/page.js` | Tabla, filtros, permisos por rol, crear, editar, dar de baja y reasignar |
| `inventario-modales.test.jsx` | `app/dashboard/inventario/page.js` | Tarjeta QR, búsqueda por código (manual y con cámara), resultado de búsqueda (acciones solo para admin), historial de bajas |
| `fechas.test.js` | `app/dashboard/_lib/fechas.js` | Fecha y hora locales para los formularios (incluye 23:30 y fin de año) |

Cobertura actual (`npm run test:coverage`): **99,7 % de líneas, 97,8 % de ramas, 98,9 % de funciones**
en todo `app/` salvo `app/layout.js`. Lo que queda sin cubrir son sobre todo ramas a las que la interfaz
no permite llegar (por ejemplo, la variante por defecto de `Btn` o `if (!token) return` en funciones que
solo se llaman con token).

### Fallos corregidos

Estaban documentados con `it.fails` y ya se corrigieron; hoy no queda ninguna prueba `it.fails`.

| Fallo | Corrección | Pruebas |
|-------|-----------|---------|
| La fecha propuesta salía en UTC: desde las 19:00 en Colombia sugería la de mañana | `app/dashboard/_lib/fechas.js` (`getHoy`, `getHoraActual` con la hora local), usado por entregar, recoger y daño | `fechas.test.js` y las pruebas de 23:30 en `entregar`, `recoger` y `dano` |
| En daño, agregar una segunda foto borraba la vista previa de la primera | Las vistas previas se liberan al quitar una foto, al enviar o al salir de la página | `dano.test.jsx` |
| El resultado de búsqueda de inventario mostraba editar/reasignar/baja a cualquier rol | Solo se muestran a admin, igual que en la tabla | `inventario-modales.test.jsx` |

## Cobertura para SonarCloud

Qué cuenta para la cobertura se define en `vitest.config.mjs` (`coverage.include: app/**/*.{js,jsx}` y
`coverage.exclude`) y coincide con `sonar.coverage.exclusions` en `sonar-project.properties` (raíz).
Exclusiones y motivo:

- `app/layout.js`: solo envuelve `<html>`/`<body>` e importa los estilos; no tiene lógica.
- `app/**/*.css`, `app/favicon.ico`, `public/**`: estilos y recursos estáticos, no son JavaScript.

`npm run test:coverage:sonar` corre la cobertura y luego `../scripts/fix-lcov-paths.mjs frontend`, que
reescribe las rutas `SF:` de `coverage/lcov.info` a rutas relativas a la raíz con `/`
(`frontend/app/login/page.js`) y comprueba que cada una existe. Para backend y frontend juntos, desde la
raíz: `npm run coverage:sonar`. El escaneo se explica en `backend/tests/README.md`.
