// Punto de entrada del servidor Express
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');

const authRoutes = require('./routes/auth.routes');
const usuarioRoutes = require('./routes/usuario.routes');
const ambulanciaRoutes = require('./routes/ambulancia.routes');
const insumoRoutes = require('./routes/insumo.routes');
const movimientosRoutes = require('./routes/movimientos');
const reportesRoutes = require('./routes/reportes.routes');
const centrosRoutes = require('./routes/centros.routes');

const app = express();
const PORT = process.env.PORT || 4000;

// --- Middlewares globales ---
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
  console.error('[ERROR]', err.message);
  // Error de validación de multer (tipo de archivo inválido)
  if (err.message && err.message.includes('Solo se permiten')) {
    return res.status(400).json({ message: err.message });
  }
  res.status(err.status || 500).json({
    message: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// --- Iniciar servidor ---
async function iniciar() {
  try {
    await sequelize.authenticate();
    console.log('[DB] Conexión a PostgreSQL establecida correctamente.');
    if (process.env.AUTO_INIT === 'true') {
      console.log('[INIT] Ejecutando inicialización automática...');
      const initDB = require('./config/initDB');
      await initDB();
      console.log('[INIT] initDB completado.');
      const seedAdmin = require('./config/seedAdmin');
      await seedAdmin();
      console.log('[INIT] seedAdmin completado.');
    }
  } catch (error) {
    console.error('[DB] No se pudo conectar a la base de datos:', error.message);
  }

  app.listen(PORT, () => {
    console.log(`[SERVER] Servidor corriendo en http://localhost:${PORT}`);
    console.log(`[SERVER] Entorno: ${process.env.NODE_ENV || 'development'}`);
  });
}

iniciar();
