// Seeder: crea o actualiza los 2 administradores del sistema
require('dotenv').config();
const bcrypt = require('bcryptjs');

async function seedAdmin() {
  const { sequelize, Role, Usuario } = require('../models');

  await sequelize.authenticate();
  console.log('[SEED] Conexión a la base de datos exitosa.');

  const rolAdmin = await Role.findOne({ where: { nombre: 'admin' } });
  if (!rolAdmin) {
    throw new Error('Rol "admin" no encontrado. Ejecuta primero: npm run db:init');
  }

  const admins = [
    { nombre: 'Administrador 01', numero_ambulancia: 'Administrador01', password_plain: 'Administrador01*' },
    { nombre: 'Administrador 02', numero_ambulancia: 'Administrador02', password_plain: 'Administrador02*' },
  ];

  for (const admin of admins) {
    const passwordHash = await bcrypt.hash(admin.password_plain, 12);
    const existente = await Usuario.findOne({ where: { numero_ambulancia: admin.numero_ambulancia } });

    if (existente) {
      await existente.update({
        nombre:           admin.nombre,
        password:         passwordHash,
        roleId:           rolAdmin.id,
        activo:           true,
        intentos_fallidos: 0,
        bloqueado_hasta:  null,
        ambulanciaId:     null,
      });
      console.log(`[SEED] Actualizado: ${admin.numero_ambulancia}`);
    } else {
      await Usuario.create({
        nombre:            admin.nombre,
        numero_ambulancia: admin.numero_ambulancia,
        password:          passwordHash,
        roleId:            rolAdmin.id,
        activo:            true,
        ambulanciaId:      null,
      });
      console.log(`[SEED] Creado: ${admin.numero_ambulancia}`);
    }

    console.log(`[SEED]   Usuario: ${admin.numero_ambulancia} | Rol: admin`);
  }

  await sequelize.close();
}

seedAdmin()
  .then(() => {
    console.log('[SEED] ✅ Administradores creados/actualizados.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[SEED] ❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  });
