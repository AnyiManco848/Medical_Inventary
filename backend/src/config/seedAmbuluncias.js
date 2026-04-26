// Seed: crea las 10 ambulancias AMB-01 a AMB-10 si no existen
require('dotenv').config();

async function seedAmbuluncias() {
  const { sequelize, Ambulancia } = require('../models');

  await sequelize.authenticate();
  console.log('[SEED] Conexión exitosa a la base de datos.');

  let creadas = 0;
  let existentes = 0;

  for (let i = 1; i <= 10; i++) {
    const codigo = `AMB-${String(i).padStart(2, '0')}`;
    const ya = await Ambulancia.findOne({ where: { codigo } });
    if (!ya) {
      await Ambulancia.create({
        codigo,
        placa: null,
        descripcion: `Ambulancia ${codigo}`,
        activa: true,
      });
      console.log(`[SEED]   ✓ Creada: ${codigo}`);
      creadas++;
    } else {
      console.log(`[SEED]   · Ya existe: ${codigo}`);
      existentes++;
    }
  }

  console.log(`[SEED] Resumen: ${creadas} creada(s), ${existentes} ya existente(s)`);
  await sequelize.close();
}

seedAmbuluncias()
  .then(() => {
    console.log('[SEED] ✅ Seed de ambulancias completado.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[SEED] ❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  });
