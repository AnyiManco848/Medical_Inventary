// Seeder: crea o actualiza el usuario administrador principal
require('dotenv').config();
const bcrypt = require('bcryptjs');

async function asegurarColumna(sequelize, tabla, columna, definicion) {
  const [cols] = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = '${tabla}' AND COLUMN_NAME = '${columna}'`
  );
  if (cols.length === 0) {
    console.log(`[SEED] Agregando columna ${columna} a ${tabla}...`);
    await sequelize.query(`ALTER TABLE [${tabla}] ADD [${columna}] ${definicion}`);
  }
}

async function seedAdmin() {
  const { sequelize, Role, Usuario } = require('../models');

  await sequelize.authenticate();
  console.log('[SEED] Conexión a la base de datos exitosa.');

  // Asegurar que las columnas del modelo existen antes de consultarlas
  await asegurarColumna(sequelize, 'Usuarios', 'cedula', 'NVARCHAR(15) NULL');
  await asegurarColumna(sequelize, 'Usuarios', 'numero_ambulancia', 'NVARCHAR(50) NULL');
  await asegurarColumna(sequelize, 'Usuarios', 'ambulanciaId', 'INT NULL REFERENCES [Ambulancias]([id])');

  // Obtener el rol admin
  const rolAdmin = await Role.findOne({ where: { nombre: 'admin' } });
  if (!rolAdmin) {
    throw new Error(
      'Rol "admin" no encontrado. Ejecuta primero: npm run db:init'
    );
  }

  const CEDULA = '1038798848';
  const PASSWORD_PLAIN = '1030Anyi*';
  const passwordHash = await bcrypt.hash(PASSWORD_PLAIN, 12);

  const usuarioExistente = await Usuario.findOne({ where: { cedula: CEDULA } });

  if (usuarioExistente) {
    console.log('[SEED] Usuario ya existe. Actualizando datos...');
    await usuarioExistente.update({
      numero_ambulancia: '01',
      password: passwordHash,
      roleId: rolAdmin.id,
      activo: true,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      ambulanciaId: null, // los admin no tienen ambulancia asignada
    });
    console.log('[SEED] Usuario actualizado correctamente.');
  } else {
    console.log('[SEED] Creando nuevo usuario administrador...');
    await Usuario.create({
      nombre: 'Anyi',
      cedula: CEDULA,
      numero_ambulancia: '01',
      password: passwordHash,
      roleId: rolAdmin.id,
      activo: true,
      ambulanciaId: null,
    });
    console.log('[SEED] Usuario creado correctamente.');
  }

  console.log('[SEED] ──────────────────────────────────');
  console.log('[SEED]   Cédula:           ' + CEDULA);
  console.log('[SEED]   Núm. ambulancia:  01');
  console.log('[SEED]   Rol:              admin');
  console.log('[SEED] ──────────────────────────────────');

  await sequelize.close();
}

seedAdmin()
  .then(() => {
    console.log('[SEED] ✅ Seeder ejecutado exitosamente.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[SEED] ❌ Error en el seeder:', err.message);
    console.error(err);
    process.exit(1);
  });
