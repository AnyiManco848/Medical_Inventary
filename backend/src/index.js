// Punto de entrada del servidor Express
require('dotenv').config();
const { sequelize } = require('./models');
const app = require('./app');

const PORT = process.env.PORT || 4000;

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
