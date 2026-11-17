// Aplicación Express (sin arrancar el servidor).
// Se separa de index.js para poder importarla en pruebas (supertest / saturación).
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('node:path');

const authRoutes = require('./routes/auth.routes');
const usuarioRoutes = require('./routes/usuario.routes');
const ambulanciaRoutes = require('./routes/ambulancia.routes');
const insumoRoutes = require('./routes/insumo.routes');
const movimientosRoutes = require('./routes/movimientos');
const reportesRoutes = require('./routes/reportes.routes');
const centrosRoutes = require('./routes/centros.routes');

const app = express();

// No anunciar "X-Powered-By: Express": revela el framework y facilita buscar fallos conocidos
app.disable('x-powered-by');

// Detrás de Caddy (1 proxy): req.ip, req.protocol y req.secure reflejan al cliente real
app.set('trust proxy', 1);

// Cabeceras de seguridad: HSTS (1 año), nosniff, frame-ancestors, etc.
// 'same-site' deja que el frontend (otro puerto en local) cargue las fotos de /uploads
app.use(helmet({
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
  crossOriginResourcePolicy: { policy: 'same-site' },
}));

// --- Middlewares globales ---
// Solo el dominio HTTPS de producción; localhost:3000 únicamente fuera de producción
const ORIGEN_PRODUCCION = 'https://medicalinventary.duckdns.org';
const origenesPermitidos = [process.env.FRONTEND_URL || ORIGEN_PRODUCCION];
if (process.env.NODE_ENV !== 'production') origenesPermitidos.push('http://localhost:3000');

app.use(cors({
  origin: origenesPermitidos,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir imágenes de insumos como archivos estáticos
// La ruta absoluta del servidor nunca se expone en las respuestas de la API
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Rutas ---
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/ambulancias', ambulanciaRoutes);
app.use('/api/insumos', insumoRoutes);
app.use('/api', movimientosRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/centros', centrosRoutes);

// Ruta de salud del servidor
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Manejo global de errores ---
app.use((err, req, res, next) => {
  // JSON mal formado (body parser): su mensaje puede incluir parte del cuerpo, que en el login
  // lleva credenciales. No se registra err.message ni el cuerpo, solo un texto fijo.
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    console.error('[ERROR]', 'JSON inválido');
    return res.status(400).json({ message: 'El cuerpo de la petición no es un JSON válido.' });
  }

  console.error('[ERROR]', err.message);
  // Archivo más grande que el límite de multer (5 MB fotos de baja, 8 MB evidencias)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'El archivo es demasiado grande. Reduce el tamaño de la imagen e inténtalo de nuevo.' });
  }
  // Error de validación de multer (tipo de archivo inválido)
  if (typeof err.message === 'string' && err.message.includes('Solo se permiten')) {
    return res.status(400).json({ message: err.message });
  }
  res.status(err.status || 500).json({
    message: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
