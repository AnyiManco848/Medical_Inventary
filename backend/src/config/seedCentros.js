// Seed: inserta los 22 centros asistenciales si aún no existen (por nombre)
require('dotenv').config();

const CENTROS = [
  'Hospital General de Medellín',
  'Hospital Pablo Tobón Uribe',
  'Clínica Las Américas',
  'Clínica El Rosario',
  'Clínica Medellín',
  'IPS Universitaria',
  'Hospital Universitario San Vicente Fundación',
  'Clínica Soma',
  'Clínica CES',
  'Hospital Mental de Antioquia',
  'ESE Metrosalud',
  'Hospital Marco Fidel Suárez',
  'Clínica Bello Salud',
  'Hospital del Sur Gabriel Jaime Sierra',
  'Clínica Bethsaida',
  'Hospital Manuel Uribe Ángel',
  'ESE Hospital La María',
  'Hospital La Estrella ESE',
  'Hospital Francisco Valderrama',
  'Hospital Venancio Díaz Díaz',
  'Hospital San Rafael de Girardota',
  'Hospital San Vicente de Paúl de Barbosa',
];

async function seed() {
  const { CentroAsistencial } = require('../models');
  const hoy = new Date().toISOString().split('T')[0];

  let creados = 0;
  let omitidos = 0;

  for (const nombre of CENTROS) {
    const existe = await CentroAsistencial.findOne({ where: { nombre } });
    if (existe) {
      console.log(`[SEED] Omitido (ya existe): ${nombre}`);
      omitidos++;
    } else {
      await CentroAsistencial.create({
        nombre,
        municipio:     'Valle de Aburrá',
        activo:        true,
        esOtro:        false,
        fechaRegistro: hoy,
      });
      console.log(`[SEED] ✓ Creado: ${nombre}`);
      creados++;
    }
  }

  console.log(`\n[SEED] Resumen: ${creados} creados, ${omitidos} ya existían.`);
}

seed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[SEED] Error:', err.message);
    process.exit(1);
  });
