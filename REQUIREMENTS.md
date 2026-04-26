# Dependencias del proyecto — Medical Inventary

---

## Backend (`backend/`)

### Dependencias de producción

| Paquete          | Versión   | Para qué se usa |
|------------------|-----------|-----------------|
| `express`        | ^5.2.1    | Framework HTTP para crear la API REST. Maneja rutas, middlewares y respuestas. |
| `sequelize`      | ^6.37.8   | ORM (Object-Relational Mapper) para interactuar con SQL Server usando modelos JavaScript en vez de SQL directo. |
| `tedious`        | ^19.2.1   | Driver nativo de Node.js para SQL Server. Sequelize lo usa internamente para conectarse a la base de datos. |
| `dotenv`         | ^17.4.1   | Carga las variables de entorno del archivo `.env` para no escribir credenciales en el código. |
| `bcryptjs`       | ^3.0.3    | Hashea las contraseñas antes de guardarlas en la BD. También se usa para comparar al hacer login. |
| `jsonwebtoken`   | ^9.0.3    | Genera y verifica tokens JWT (JSON Web Tokens) usados para autenticar a los usuarios. |
| `cors`           | ^2.8.6    | Permite que el frontend (localhost:3000) haga peticiones al backend (localhost:4000) sin ser bloqueado por el navegador. |

### Dependencias de desarrollo

| Paquete     | Versión   | Para qué se usa |
|-------------|-----------|-----------------|
| `nodemon`   | ^3.1.14   | Reinicia el servidor automáticamente cada vez que se guarda un archivo. Solo se usa durante desarrollo. |

---

## Frontend (`frontend/`)

### Dependencias de producción

| Paquete      | Versión   | Para qué se usa |
|--------------|-----------|-----------------|
| `next`       | 16.2.2    | Framework de React con App Router, renderizado en servidor y sistema de rutas basado en archivos. |
| `react`      | 19.2.4    | Librería base para construir la interfaz de usuario con componentes. |
| `react-dom`  | 19.2.4    | Permite a React renderizar componentes en el DOM del navegador. |
| `axios`      | ^1.14.0   | Cliente HTTP para hacer peticiones a la API del backend (GET, POST, PUT, DELETE). |
| `js-cookie`  | ^3.0.5    | Leer y escribir cookies en el navegador. Se usa para guardar el token JWT tras el login. |

### Dependencias de desarrollo

| Paquete               | Versión | Para qué se usa |
|-----------------------|---------|-----------------|
| `tailwindcss`         | ^4      | Framework CSS de utilidades para aplicar estilos directamente en el HTML. |
| `@tailwindcss/postcss`| ^4      | Plugin de PostCSS que procesa Tailwind CSS durante el build de Next.js. |

---

## Requisitos del sistema

| Herramienta  | Versión mínima | Notas |
|--------------|---------------|-------|
| Node.js      | 18.x          | Necesario para ejecutar tanto el backend como el frontend |
| npm          | 9.x           | Gestor de paquetes incluido con Node.js |
| SQL Server   | 2017          | Puede ser SQL Server Express (gratis). Debe tener autenticación SQL habilitada. |

---

## Instalación de dependencias

Si clonas el proyecto desde cero, instala las dependencias en cada carpeta:

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```
