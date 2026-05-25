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

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

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
