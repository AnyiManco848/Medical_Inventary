const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

// Verificación del certificado SSL del servidor de base de datos (solo con DATABASE_URL).
// Por defecto NO se verifica (comportamiento histórico, para no romper el despliegue actual).
// Con DB_SSL_REJECT_UNAUTHORIZED=true se rechaza un certificado inválido o no confiable.
const verificarCertificado = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: verificarCertificado,
      },
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  });
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'MedicalInventary',
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    }
  );
}

module.exports = sequelize;
