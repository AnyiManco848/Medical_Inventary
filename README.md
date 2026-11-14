# MedicalInventary

Sistema web para la gestión y trazabilidad de insumos médicos en flotas de ambulancias.

---

## ¿Qué hace este proyecto?

MedicalInventary es una aplicación fullstack que permite a una organización médica controlar el inventario de insumos (collarines, vendas, oxígeno, etc.) que circulan entre sus ambulancias y centros asistenciales.

### Funcionalidades principales

- **Autenticación segura** con JWT y bloqueo automático tras 3 intentos fallidos (cuenta bloqueada 24h).
- **Control de roles** — dos tipos de usuario:
  - `admin` — gestiona usuarios, insumos, ambulancias y centros asistenciales.
  - `ambulancia` — registra entregas, recuperaciones y reportes de daño o pérdida.
- **Trazabilidad completa** — cada insumo tiene historial de entregas, recuperaciones y bajas.
- **Códigos QR** — cada insumo físico tiene un código único (`INS-FAM-###`) y su QR para escaneo rápido.
- **Reportes** — exportación a PDF y Excel desde el navegador.

---

## Arquitectura

```
MedicalInventary/
├── backend/    → API REST · Node.js + Express 5 + Sequelize + PostgreSQL
└── frontend/   → Interfaz web · Next.js 16 + React 19
```

**Stack tecnológico:**

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4, Axios, js-cookie |
| Backend | Node.js, Express 5, Sequelize 6, bcryptjs, jsonwebtoken, multer, qrcode |
| Base de datos | PostgreSQL 15 |
| Despliegue | Render.com (backend + frontend) |

---

## Requisitos para desarrollo local

| Herramienta | Versión mínima |
|-------------|---------------|
| Node.js | 18.x |
| npm | 9.x |
| PostgreSQL | 15.x |

---

## Instalación local

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd Medical_Inventary
```

### 2. Configurar variables de entorno del backend

> Guía completa de variables (qué archivo copiar, cuáles son secretas, cómo comprobar que no falta
> ninguna y cómo guardar `SONAR_TOKEN`): [docs/ENV.md](docs/ENV.md).
> En Windows usa `copy` en lugar de `cp`.

```bash
cd backend
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL local
```

### 3. Configurar variables de entorno del frontend

```bash
cd ../frontend
cp .env.local.example .env.local
# Si usas el backend local, dejar: NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 4. Instalar dependencias e inicializar la base de datos

```bash
# Backend
cd backend
npm install
npm run db:init         # Crea tablas y roles
npm run db:seed-admin   # Crea usuario administrador por defecto

# Frontend
cd ../frontend
npm install
```

### 5. Iniciar en modo desarrollo

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

- Backend: http://localhost:4000
- Frontend: http://localhost:3000

---

## Despliegue con Docker (local)

```bash
# En la raíz del proyecto
cp backend/.env.example backend/.env   # Completar variables
docker compose up --build
```

> Este `docker-compose.yml` es el de producción con HTTPS: los puertos 3000 y 4000 ya **no** se publican, solo Caddy (80/443) y necesita el dominio real (ver la sección siguiente). Para desarrollo local usa `npm run dev` (arriba).

---

## Despliegue en EC2 con HTTPS (Docker Compose + Caddy)

Las credenciales de inicio de sesión **nunca deben viajar por HTTP**. En producción solo el contenedor `caddy` es accesible desde Internet: termina HTTPS con un certificado de Let's Encrypt (se emite y renueva solo) y enruta `/api/*` y `/uploads/*` al backend, y todo lo demás al frontend. `frontend`, `backend` y `db` usan `expose` (red interna de Docker), no `ports`.

### 1. Security Group de la EC2

| Puerto | Estado | Motivo |
|--------|--------|--------|
| **80** (TCP, 0.0.0.0/0) | **Abierto** | Validación ACME de Let's Encrypt y redirección a HTTPS |
| **443** (TCP, 0.0.0.0/0) | **Abierto** | Tráfico HTTPS |
| 22 (TCP) | Solo tu IP | SSH |
| **3000** (frontend) | **Cerrado** | Solo accesible vía Caddy |
| **4000** (backend) | **Cerrado** | Solo accesible vía Caddy |
| 5432 (PostgreSQL) | **Cerrado** | Solo red interna |

### 2. DNS

El dominio `medicalinventary.duckdns.org` debe apuntar a la IP pública (Elastic IP) de la EC2. Sin eso Caddy no podrá obtener el certificado.

### 3. Variables y despliegue

```bash
git clone <repo> && cd Medical_Inventary
# Archivo .env en la raíz (no se sube al repo): DB_USER, DB_PASSWORD, JWT_SECRET
printf 'DB_USER=medinv
DB_PASSWORD=%s
JWT_SECRET=%s
' "$(openssl rand -hex 24)" "$(openssl rand -hex 32)" > .env
chmod 600 .env

docker compose up -d --build
docker compose run --rm backend node src/config/initDB.js   # solo la primera vez (tablas, roles y usuarios)
```

- `NEXT_PUBLIC_API_URL` se fija **al compilar** el frontend: ya vale `https://medicalinventary.duckdns.org` en `docker-compose.yml` y en `frontend/Dockerfile`. Va **sin** `/api` al final porque el código añade `/api/...` en cada petición. Si cambias el dominio, reconstruye con `docker compose build frontend`.
- `FRONTEND_URL` (CORS del backend) es `https://medicalinventary.duckdns.org`. El backend solo acepta ese origen (y `http://localhost:3000` cuando `NODE_ENV` no es `production`).
- Si cambias de dominio, edita también el [`Caddyfile`](Caddyfile).

### 4. Verificación

```bash
curl -I http://medicalinventary.duckdns.org          # 308 -> https
curl -I https://medicalinventary.duckdns.org/api/health   # 200 + strict-transport-security
curl -m 5 http://<IP_PUBLICA>:4000/api/health         # debe fallar (puerto cerrado)
docker compose logs caddy                              # emisión del certificado
```

No borres el volumen `caddy_data` (guarda los certificados; Let's Encrypt limita las emisiones por semana).

> La variante con imágenes en ECR y límites de memoria para t3.micro está en `docker-compose.prod.yml` y `deploy/aws/Caddyfile`.

### Seguridad de credenciales

- Las contraseñas se guardan con **bcrypt** (coste 12) en el seed, `initDB` y el CRUD de usuarios; el login compara con `bcrypt.compare`.
- El login responde solo `token` y datos del usuario, nunca el hash. Ningún log imprime `req.body`.
- El JWT viaja en el header `Authorization: Bearer`; la cookie del frontend es `SameSite=Strict` y `Secure` bajo HTTPS.
- El bloqueo de 24 h tras 3 intentos fallidos se mantiene.
- El backend envía HSTS y demás cabeceras con `helmet` y confía en un proxy (`trust proxy`).

---

## Despliegue en Render.com

El proyecto está configurado para desplegarse en [Render.com](https://render.com).

### Backend (Web Service)

1. Crear un **Web Service** en Render apuntando a la carpeta `backend/`.
2. Render detecta el `Procfile` automáticamente:
   ```
   web: node src/config/initDB.js && node src/index.js
   ```
3. Configurar las siguientes variables de entorno en el dashboard de Render:

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | Connection string de tu PostgreSQL (desde Render PostgreSQL o externo) |
| `JWT_SECRET` | Secreto seguro (generar con `openssl rand -hex 32`) |
| `FRONTEND_URL` | URL pública de tu frontend en Render |
| `NODE_ENV` | `production` |
| `JWT_EXPIRES_IN` | `8h` |

### Frontend (Web Service)

1. Crear un **Web Service** en Render apuntando a la carpeta `frontend/`.
2. Render usa el `Dockerfile` del frontend automáticamente.
3. Configurar la variable de entorno:

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | URL pública de tu backend en Render (ej: `https://medicalinventary-api.onrender.com`) |

---

## Comandos útiles del backend

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor en modo desarrollo con recarga automática |
| `npm start` | Servidor en modo producción |
| `npm run db:init` | Crea tablas y roles en la BD |
| `npm run db:seed-admin` | Crea usuario administrador por defecto |
| `npm run db:seed-ambulancias` | Crea las ambulancias iniciales |
| `npm run db:seed-insumos` | Crea el catálogo inicial de insumos |
| `npm run db:seed-centros` | Crea los centros asistenciales iniciales |

---

## Endpoints principales de la API

| Método | Ruta | Protegida | Descripción |
|--------|------|-----------|-------------|
| POST | `/api/auth/login` | No | Iniciar sesión |
| GET | `/api/health` | No | Estado del servidor |
| GET | `/api/insumos` | JWT | Listar insumos |
| POST | `/api/movimientos/entrega` | JWT | Registrar entrega de insumo |
| POST | `/api/movimientos/recogida` | JWT | Registrar recogida de insumo |
| GET | `/api/reportes/mis-entregas` | JWT + ambulancia | Historial propio |
| GET | `/api/reportes/admin/historial` | JWT + admin | Trazabilidad completa |
| GET | `/api/usuarios` | JWT + admin | Listar usuarios |

---

## Estructura de carpetas

```
backend/
├── src/
│   ├── config/         → BD, uploads, seeds, initDB
│   ├── controllers/    → Lógica de negocio (7 controladores)
│   ├── middlewares/    → auth.middleware.js, role.middleware.js
│   ├── models/         → Modelos Sequelize (13 modelos)
│   ├── routes/         → Definición de rutas (7 archivos)
│   └── index.js        → Punto de entrada Express
├── uploads/            → Imágenes de insumos y evidencias (gitignored)
├── .env.example        → Plantilla de variables de entorno
├── Dockerfile          → Imagen Docker del backend
└── Procfile            → Comando de inicio para Render

frontend/
├── app/
│   ├── login/          → Página de inicio de sesión
│   └── dashboard/      → Panel principal y sub-páginas por rol
├── .env.local.example  → Plantilla de variables de entorno
└── Dockerfile          → Imagen Docker multi-stage (Next.js standalone)
```
