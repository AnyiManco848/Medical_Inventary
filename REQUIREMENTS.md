# Dependencias del proyecto — MedicalInventary

---

## Backend (`backend/`)

### Dependencias de producción

| Paquete | Versión | Para qué se usa |
|---------|---------|-----------------|
| `express` | ^5.2.1 | Framework HTTP para la API REST |
| `sequelize` | ^6.37.8 | ORM para interactuar con PostgreSQL mediante modelos JavaScript |
| `pg` | ^8.20.0 | Driver nativo de PostgreSQL para Node.js |
| `pg-hstore` | ^2.3.4 | Serialización del tipo hstore de PostgreSQL |
| `bcryptjs` | ^3.0.3 | Hashing seguro de contraseñas (costo 12) |
| `jsonwebtoken` | ^9.0.3 | Generación y verificación de tokens JWT |
| `cors` | ^2.8.6 | Control de política de origen cruzado |
| `dotenv` | ^17.4.1 | Carga de variables de entorno desde `.env` |
| `multer` | ^2.1.1 | Manejo de subida de archivos (imágenes de insumos y evidencias) |
| `qrcode` | ^1.5.4 | Generación de códigos QR para insumos |

### Dependencias de desarrollo

| Paquete | Versión | Para qué se usa |
|---------|---------|-----------------|
| `nodemon` | ^3.1.14 | Recarga automática del servidor en desarrollo |

---

## Frontend (`frontend/`)

### Dependencias de producción

| Paquete | Versión | Para qué se usa |
|---------|---------|-----------------|
| `next` | 16.2.2 | Framework React con App Router y SSR |
| `react` | 19.2.4 | Librería base de UI |
| `react-dom` | 19.2.4 | Renderizado de componentes en el DOM |
| `axios` | ^1.14.0 | Cliente HTTP para llamadas a la API REST |
| `js-cookie` | ^3.0.5 | Lectura/escritura de cookies (token JWT) |
| `html5-qrcode` | ^2.3.8 | Escaneo de códigos QR desde la cámara del dispositivo |
| `jspdf` | ^4.2.1 | Generación de reportes PDF en el navegador |
| `jspdf-autotable` | ^5.0.7 | Tablas en PDFs generados con jsPDF |
| `xlsx` | ^0.18.5 | Exportación de datos a formato Excel |

### Dependencias de desarrollo

| Paquete | Versión | Para qué se usa |
|---------|---------|-----------------|
| `tailwindcss` | ^4 | Framework CSS de utilidades |
| `@tailwindcss/postcss` | ^4 | Plugin PostCSS para procesar Tailwind en Next.js |

---

## Requisitos del sistema

| Herramienta | Versión mínima | Notas |
|-------------|---------------|-------|
| Node.js | 18.x | Necesario para backend y frontend |
| npm | 9.x | Incluido con Node.js |
| PostgreSQL | 15.x | En desarrollo local; en producción se usa el de Render |

---

## Plataforma de despliegue

| Servicio | Plataforma |
|----------|-----------|
| Backend (API REST) | Render.com — Web Service |
| Frontend (Next.js) | Render.com — Web Service |
| Base de datos | PostgreSQL (Render o proveedor externo) |
