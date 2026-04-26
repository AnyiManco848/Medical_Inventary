# Medical Inventary

Sistema web para la gestión y trazabilidad de insumos médicos entre hospitales y ambulancias.

---

## ¿Qué hace este proyecto?

Medical Inventary es una aplicación fullstack que permite a una organización médica controlar el inventario de insumos (medicamentos, equipos, materiales) que circulan entre sus ambulancias y hospitales.

### Funcionalidades principales

- **Autenticación segura** con JWT y bloqueo automático tras 3 intentos fallidos (cuenta bloqueada 24h).
- **Control de roles**: el sistema tiene dos tipos de usuarios:
  - `admin` — gestiona usuarios, insumos, hospitales y ambulancias.
  - `ambulancia` — registra entregas, recuperaciones y reportes de daño o pérdida.
- **Gestión de usuarios** — crear, editar y desactivar usuarios (soft delete, nunca se eliminan).
- **Trazabilidad de insumos** — cada insumo tiene un historial de a quién se entregó, cuándo, en qué estado está (entregado / recuperado / perdido / dañado) y si fue recuperado.
- **Control de stock** — cada insumo tiene un stock actual y un stock mínimo de alerta.

---

## Arquitectura del proyecto

```
Medical_Inventary/
├── backend/          → API REST con Node.js + Express + Sequelize
└── frontend/         → Interfaz web con Next.js 16 + Tailwind CSS
```

El backend expone una API REST en el puerto **4000**.  
El frontend corre en el puerto **3000** y consume esa API mediante HTTP.

---

## Requisitos previos

| Herramienta       | Versión mínima |
|-------------------|---------------|
| Node.js           | 18.x o superior |
| npm               | 9.x o superior  |
| SQL Server        | 2017 o superior (o SQL Server Express) |

---

## Instalación y ejecución

### 1. Configurar variables de entorno

Abre el archivo `backend/.env` y completa los datos de tu SQL Server:

```env
PORT=4000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=1433
DB_NAME=MedicalInventary
DB_USER=sa
DB_PASSWORD=TU_PASSWORD_AQUI
DB_ENCRYPT=false
DB_TRUST_CERT=true
DB_INSTANCE=

JWT_SECRET=medical_inventary_jwt_secret_2024_cambiar_en_produccion
JWT_EXPIRES_IN=8h
```

> Si tu SQL Server usa una instancia con nombre (ej: `SQLEXPRESS`), escribe el nombre en `DB_INSTANCE`.

### 2. Inicializar la base de datos

Este comando crea la base de datos `MedicalInventary`, todas las tablas, los roles y el usuario administrador por defecto.

```bash
cd backend
npm run db:init
```

Usuario admin creado automáticamente:
- **Email:** `admin@medical.com`
- **Contraseña:** `Admin123!`

### 3. Iniciar el backend

```bash
cd backend
npm run dev
```

El servidor quedará corriendo en: `http://localhost:4000`

### 4. Iniciar el frontend

Abre una segunda terminal:

```bash
cd frontend
npm run dev
```

La aplicación quedará disponible en: `http://localhost:3000`

---

## Comandos disponibles

### Backend (`cd backend`)

| Comando            | Descripción                                      |
|--------------------|--------------------------------------------------|
| `npm run dev`      | Servidor en modo desarrollo con recarga automática |
| `npm start`        | Servidor en modo producción                       |
| `npm run db:init`  | Crea la BD, tablas, roles y usuario admin         |

### Frontend (`cd frontend`)

| Comando          | Descripción                            |
|------------------|----------------------------------------|
| `npm run dev`    | Servidor Next.js en modo desarrollo    |
| `npm run build`  | Construir para producción              |
| `npm start`      | Servir la build de producción          |

---

## Cómo se conectan el frontend y el backend

El frontend (Next.js) y el backend (Express) son dos aplicaciones independientes que se comunican a través de la **API REST** del backend.

### Flujo de comunicación

```
Navegador (localhost:3000)
        │
        │  HTTP Request  (axios)
        ▼
API REST (localhost:4000)
        │
        │  Sequelize ORM
        ▼
SQL Server (localhost:1433)
```

### 1. El frontend hace peticiones HTTP con Axios

Cada vez que la interfaz necesita datos (login, listar usuarios, crear un usuario, etc.), usa `axios` para enviar una petición al backend:

```js
// Ejemplo: login
const { data } = await axios.post('http://localhost:4000/api/auth/login', {
  email: 'admin@medical.com',
  password: 'Admin123!',
});
```

### 2. El backend responde con JSON + Token JWT

El backend procesa la petición, consulta la base de datos y devuelve una respuesta JSON. En el caso del login, devuelve un **token JWT**:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": 1,
    "nombre": "Administrador",
    "email": "admin@medical.com",
    "rol": "admin"
  }
}
```

### 3. El token se guarda en una cookie

El frontend guarda el token en una cookie con `js-cookie`:

```js
Cookies.set('token', data.token, { expires: 1/3 }); // 8 horas
```

### 4. Las rutas protegidas envían el token en cada petición

Para las rutas que requieren autenticación (como `/api/usuarios`), el frontend incluye el token en el header `Authorization`:

```js
const { data } = await axios.get('http://localhost:4000/api/usuarios', {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 5. El backend valida el token antes de responder

El middleware `auth.middleware.js` intercepta la petición, verifica el JWT y, si es válido, permite continuar. Si no lo es, devuelve un error `401 Unauthorized`.

### Endpoints de la API

| Método | Ruta                    | Descripción                    | Protegida |
|--------|-------------------------|--------------------------------|-----------|
| POST   | `/api/auth/login`       | Iniciar sesión                 | No        |
| GET    | `/api/health`           | Estado del servidor            | No        |
| GET    | `/api/usuarios`         | Listar usuarios con rol        | Admin     |
| POST   | `/api/usuarios`         | Crear nuevo usuario            | Admin     |
| PUT    | `/api/usuarios/:id`     | Editar usuario                 | Admin     |
| DELETE | `/api/usuarios/:id`     | Desactivar usuario (soft delete)| Admin     |

---

## Estructura de carpetas

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js       → Configuración de Sequelize + SQL Server
│   │   └── initDB.js         → Script de inicialización de la BD
│   ├── models/
│   │   ├── index.js          → Importa modelos y define asociaciones
│   │   ├── Role.js
│   │   ├── Usuario.js
│   │   ├── Ambulancia.js
│   │   ├── Hospital.js
│   │   ├── Insumo.js
│   │   └── Trazabilidad.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   └── usuario.controller.js
│   ├── middlewares/
│   │   ├── auth.middleware.js   → Verifica JWT
│   │   └── role.middleware.js   → Verifica rol del usuario
│   ├── routes/
│   │   ├── auth.routes.js
│   │   └── usuario.routes.js
│   └── index.js                 → Punto de entrada Express
├── .env                         → Variables de entorno (no subir a git)
├── .env.example                 → Plantilla de variables de entorno
└── package.json

frontend/
├── app/
│   ├── layout.js                → Layout raíz (tema oscuro)
│   ├── globals.css              → Estilos globales
│   ├── page.js                  → Redirige a /login
│   ├── login/
│   │   └── page.js              → Pantalla de inicio de sesión
│   └── dashboard/
│       ├── page.js              → Panel principal según rol
│       └── usuarios/
│           └── page.js          → Gestión de usuarios (solo admin)
└── package.json
```
