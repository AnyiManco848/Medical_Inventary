// Inicialización completa: BD → tablas → migraciones → seeds
require('dotenv').config();
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const DB_NAME     = process.env.DB_NAME || 'MedicalInventary';
const DB_USER     = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_HOST     = process.env.DB_HOST;
const DB_PORT     = parseInt(process.env.DB_PORT) || 5432;

// ── Stock seed ────────────────────────────────────────────────────────────────
const STOCK_BODEGA = [
  { nombre: 'Collarín cervical adulto',    familia: 'Collarín cervical', familia_abrev: 'COL', especificaciones: 'Adulto',    cantidad: 10 },
  { nombre: 'Collarín cervical pediátrico',familia: 'Collarín cervical', familia_abrev: 'COL', especificaciones: 'Pediátrico', cantidad:  8 },
  { nombre: 'Camilla Baxstrap',            familia: 'Baxstrap',          familia_abrev: 'BAX', especificaciones: null,         cantidad:  5 },
  { nombre: 'Pinza Rochester',             familia: 'Pinza Rochester',   familia_abrev: 'ROC', especificaciones: null,         cantidad: 15 },
  { nombre: 'Araña',                       familia: 'Araña',             familia_abrev: 'ARA', especificaciones: null,         cantidad:  5 },
  { nombre: 'Bloque lateral',              familia: 'Bloque lateral',    familia_abrev: 'BLQ', especificaciones: null,         cantidad: 10 },
];

const STOCK_AMBULANCIA = [
  { nombre: 'Collarín cervical adulto',    familia: 'Collarín cervical', familia_abrev: 'COL', especificaciones: 'Adulto',    cantidad: 3 },
  { nombre: 'Collarín cervical pediátrico',familia: 'Collarín cervical', familia_abrev: 'COL', especificaciones: 'Pediátrico', cantidad: 2 },
  { nombre: 'Camilla Baxstrap',            familia: 'Baxstrap',          familia_abrev: 'BAX', especificaciones: null,         cantidad: 1 },
  { nombre: 'Pinza Rochester',             familia: 'Pinza Rochester',   familia_abrev: 'ROC', especificaciones: null,         cantidad: 4 },
  { nombre: 'Araña',                       familia: 'Araña',             familia_abrev: 'ARA', especificaciones: null,         cantidad: 1 },
  { nombre: 'Bloque lateral',              familia: 'Bloque lateral',    familia_abrev: 'BLQ', especificaciones: null,         cantidad: 2 },
];

async function crearBaseDeDatos() {
  if (process.env.DATABASE_URL) {
    console.log('[DB] DATABASE_URL detectada — omitiendo creación de base de datos.');
    return;
  }

  console.log('[DB] Conectando al servidor PostgreSQL (postgres)...');
  const seqMaster = new Sequelize('postgres', DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'postgres',
    logging: false,
  });

  await seqMaster.authenticate();
  console.log('[DB] Conexión a postgres exitosa.');

  const [results] = await seqMaster.query(
    `SELECT datname FROM pg_database WHERE datname = '${DB_NAME}'`
  );
  if (results.length === 0) {
    console.log(`[DB] Creando base de datos "${DB_NAME}"...`);
    await seqMaster.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`[DB] Base de datos "${DB_NAME}" creada.`);
  } else {
    console.log(`[DB] Base de datos "${DB_NAME}" ya existe.`);
  }

  await seqMaster.close();
}

async function agregarColumna(sequelize, tabla, columna, tipo) {
  const [rows] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = '${tabla}' AND column_name = '${columna}'`
  );
  if (rows.length === 0) {
    console.log(`[DB] Agregando columna ${columna} a ${tabla}...`);
    await sequelize.query(`ALTER TABLE "${tabla}" ADD COLUMN "${columna}" ${tipo}`);
    console.log(`[DB] ✓ ${columna} agregada.`);
  }
}

async function sincronizarTablas() {
  console.log('[DB] Conectando a la base de datos...');
  const {
    sequelize, Role, Usuario, Ambulancia, Insumo, MovimientoInventario, ContadorCodigo,
    CentroAsistencial,
  } = require('../models');

  await sequelize.authenticate();
  console.log('[DB] Conexión exitosa.');

  // Extensiones PostgreSQL requeridas
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS unaccent');

  console.log('[DB] Sincronizando tablas...');
  await sequelize.sync({ force: false });
  console.log('[DB] Tablas sincronizadas.');

  // ── Migraciones: tabla Usuarios ───────────────────────────────────────────
  await agregarColumna(sequelize, 'Usuarios', 'ambulanciaId',
    'INT NULL REFERENCES "Ambulancias"("id")');
  await agregarColumna(sequelize, 'Usuarios', 'numero_ambulancia', 'VARCHAR(50) NULL');

  // Eliminar índice único en cedula si existe
  const [idxCedula] = await sequelize.query(`
    SELECT i.relname AS name
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE t.relname = 'Usuarios' AND a.attname = 'cedula' AND ix.indisunique = true
  `);
  for (const idx of idxCedula) {
    await sequelize.query(`DROP INDEX IF EXISTS "${idx.name}"`);
    console.log(`[DB] Índice ${idx.name} (cedula) eliminado.`);
  }

  // Eliminar columna cedula si existe
  const [colCedula] = await sequelize.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'Usuarios' AND column_name = 'cedula'`
  );
  if (colCedula.length > 0) {
    await sequelize.query(`ALTER TABLE "Usuarios" DROP COLUMN "cedula"`);
    console.log('[DB] Columna cedula eliminada.');
  }

  // Crear índice único en numero_ambulancia si no existe
  const [idxNumAmb] = await sequelize.query(
    `SELECT indexname AS name FROM pg_indexes
     WHERE tablename = 'Usuarios' AND indexname = 'Usuarios_numero_ambulancia'`
  );
  if (idxNumAmb.length === 0) {
    await sequelize.query(
      `CREATE UNIQUE INDEX "Usuarios_numero_ambulancia" ON "Usuarios"("numero_ambulancia") WHERE "numero_ambulancia" IS NOT NULL`
    );
    console.log('[DB] Índice único en numero_ambulancia creado.');
  }

  // ── Migraciones: tabla Insumos ─────────────────────────────────────────────
  const columnasInsumos = [
    { name: 'cantidad_disponible', tipo: 'INT NOT NULL DEFAULT 1' },
    { name: 'estado',              tipo: "VARCHAR(20) NOT NULL DEFAULT 'activo'" },
    { name: 'codigo_qr',           tipo: 'VARCHAR(255) NULL' },
    { name: 'imagen_ruta',         tipo: 'VARCHAR(500) NULL' },
    { name: 'fecha_registro',      tipo: 'TIMESTAMP NULL' },
    { name: 'observaciones',       tipo: 'VARCHAR(500) NULL' },
    { name: 'codigo',              tipo: 'VARCHAR(20) NULL' },
    { name: 'familia',             tipo: 'VARCHAR(50) NULL' },
    { name: 'familia_abrev',       tipo: 'VARCHAR(5) NULL' },
    { name: 'especificaciones',    tipo: 'VARCHAR(500) NULL' },
    { name: 'ambulanciaId',        tipo: 'INT NULL' },
  ];

  for (const col of columnasInsumos) {
    await agregarColumna(sequelize, 'Insumos', col.name, col.tipo);
  }

  // Poblar codigo_qr con UUID para insumos legacy que tengan NULL
  const [sinQR] = await sequelize.query(`SELECT id FROM "Insumos" WHERE "codigo_qr" IS NULL`);
  for (const row of sinQR) {
    await sequelize.query(
      `UPDATE "Insumos" SET "codigo_qr" = ? WHERE id = ?`,
      { replacements: [crypto.randomUUID(), row.id] }
    );
  }
  if (sinQR.length > 0) console.log(`[DB] UUID generado para ${sinQR.length} insumo(s) sin QR.`);

  // Índice único en codigo_qr
  const [idxQR] = await sequelize.query(
    `SELECT indexname AS name FROM pg_indexes WHERE tablename = 'Insumos' AND indexname = 'UQ_Insumos_CodigoQR'`
  );
  if (idxQR.length === 0) {
    await sequelize.query(
      `CREATE UNIQUE INDEX "UQ_Insumos_CodigoQR" ON "Insumos"("codigo_qr") WHERE "codigo_qr" IS NOT NULL`
    );
    console.log('[DB] Índice único en codigo_qr creado.');
  }

  // Índice único en codigo
  const [idxCodigo] = await sequelize.query(
    `SELECT indexname AS name FROM pg_indexes WHERE tablename = 'Insumos' AND indexname = 'UQ_Insumos_Codigo'`
  );
  if (idxCodigo.length === 0) {
    await sequelize.query(
      `CREATE UNIQUE INDEX "UQ_Insumos_Codigo" ON "Insumos"("codigo") WHERE "codigo" IS NOT NULL`
    );
    console.log('[DB] Índice único en codigo creado.');
  }

  // ── Inicializar ContadorCodigo ─────────────────────────────────────────────
  const [contRows] = await sequelize.query(`SELECT COUNT(1)::int AS cnt FROM "ContadorCodigo"`);
  if ((contRows[0]?.cnt ?? 0) == 0) {
    await sequelize.query(`INSERT INTO "ContadorCodigo" ("valor") VALUES (0)`);
    console.log('[DB] Contador de códigos inicializado.');
  }

  // ── Seed: CentrosAsistenciales ─────────────────────────────────────────────
  const countCentros = await CentroAsistencial.count();
  if (countCentros === 0) {
    const hoy = new Date().toISOString().split('T')[0];
    const nombres = [
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
    const registros = nombres.map(nombre => ({
      nombre, municipio: 'Valle de Aburrá', activo: true, esOtro: false, fechaRegistro: hoy,
    }));
    registros.push({ nombre: 'Otro', municipio: 'Valle de Aburrá', activo: true, esOtro: true, fechaRegistro: hoy });
    await CentroAsistencial.bulkCreate(registros);
    console.log(`[DB] ✓ ${registros.length} centros asistenciales creados.`);
  }

  // ── Seed: 20 ambulancias AMB-01 a AMB-20 ──────────────────────────────────
  console.log('[DB] Verificando ambulancias...');
  for (let i = 1; i <= 20; i++) {
    const codigo = `AMB-${String(i).padStart(2, '0')}`;
    const ya = await Ambulancia.findOne({ where: { codigo } });
    if (!ya) {
      await Ambulancia.create({
        codigo,
        placa: null,
        descripcion: `Ambulancia ${codigo}`,
        activa: true,
      });
      console.log(`[DB]   ✓ Ambulancia creada: ${codigo}`);
    }
  }

  // ── Seed: roles ────────────────────────────────────────────────────────────
  const countRoles = await Role.count();
  if (countRoles === 0) {
    await Role.bulkCreate([
      { nombre: 'admin',      descripcion: 'Administrador del sistema' },
      { nombre: 'ambulancia', descripcion: 'Personal de ambulancia' },
    ]);
    console.log('[DB] Roles creados: admin, ambulancia.');
  }

  // ── Seed: usuarios ─────────────────────────────────────────────────────────
  // Eliminar todos los usuarios existentes y recrear el seed completo
  console.log('[DB] Eliminando usuarios existentes...');
  try {
    await sequelize.query(`DELETE FROM "Trazabilidad"`);
  } catch (_) { /* tabla vacía o sin registros dependientes */ }
  await sequelize.query(`DELETE FROM "Usuarios"`);
  console.log('[DB] Usuarios eliminados. Creando usuarios del sistema...');

  const rolAdmin = await Role.findOne({ where: { nombre: 'admin' } });
  const rolAmb   = await Role.findOne({ where: { nombre: 'ambulancia' } });

  // 20 usuarios de ambulancias
  for (let i = 1; i <= 20; i++) {
    const num              = String(i).padStart(2, '0');
    const numero_ambulancia = `Ambulancia${num}`;
    const passwordHash     = await bcrypt.hash(`${numero_ambulancia}*`, 12);
    const ambulancia       = await Ambulancia.findOne({ where: { codigo: `AMB-${num}` } });

    await Usuario.create({
      nombre:            `Ambulancia ${num}`,
      numero_ambulancia,
      password:          passwordHash,
      roleId:            rolAmb.id,
      activo:            true,
      ambulanciaId:      ambulancia?.id || null,
    });
    console.log(`[DB]   ✓ Usuario: ${numero_ambulancia}`);
  }

  // 2 administradores
  for (let i = 1; i <= 2; i++) {
    const num              = String(i).padStart(2, '0');
    const numero_ambulancia = `Administrador${num}`;
    const passwordHash     = await bcrypt.hash(`${numero_ambulancia}*`, 12);

    await Usuario.create({
      nombre:            `Administrador ${num}`,
      numero_ambulancia,
      password:          passwordHash,
      roleId:            rolAdmin.id,
      activo:            true,
      ambulanciaId:      null,
    });
    console.log(`[DB]   ✓ Admin: ${numero_ambulancia}`);
  }

  console.log('[DB] ✓ 22 usuarios creados (20 ambulancias + 2 administradores).');

  // ── Seed: insumos ──────────────────────────────────────────────────────────
  await seedInsumos(sequelize, Insumo, Ambulancia);

  await sequelize.close();
}

async function seedInsumos(sequelize, Insumo, Ambulancia) {
  const countInsumos = await Insumo.count();
  if (countInsumos > 0) {
    console.log(`[DB] Insumos ya existen (${countInsumos}), omitiendo seed.`);
    return;
  }

  const generarCodigo = async (familia_abrev) => {
    const [rows] = await sequelize.query(
      `SELECT valor FROM "ContadorCodigo" WHERE id = 1 FOR UPDATE`
    );
    const siguiente = (rows[0]?.valor ?? 0) + 1;
    await sequelize.query(
      `UPDATE "ContadorCodigo" SET valor = ${siguiente} WHERE id = 1`
    );
    return `INS-${familia_abrev.toUpperCase().slice(0, 5)}-${String(siguiente).padStart(3, '0')}`;
  };

  // Bodega primero
  let bodegaCount = 0;
  for (const p of STOCK_BODEGA) {
    for (let i = 0; i < p.cantidad; i++) {
      const codigo = await generarCodigo(p.familia_abrev);
      await Insumo.create({
        nombre: p.nombre, familia: p.familia,
        familia_abrev: p.familia_abrev.toUpperCase(),
        especificaciones: p.especificaciones,
        estado: 'activo', cantidad_disponible: 1,
        ambulanciaId: null,
        fecha_registro: new Date(),
        codigo_qr: codigo,
        codigo,
      });
      bodegaCount++;
    }
  }
  console.log(`[DB] ✓ Insumos de bodega creados (${bodegaCount} insumos)`);

  // Por ambulancia AMB-01 a AMB-20
  for (let i = 1; i <= 20; i++) {
    const num = String(i).padStart(2, '0');
    const amb = await Ambulancia.findOne({ where: { codigo: `AMB-${num}` } });
    if (!amb) continue;

    let ambCount = 0;
    for (const p of STOCK_AMBULANCIA) {
      for (let j = 0; j < p.cantidad; j++) {
        const codigo = await generarCodigo(p.familia_abrev);
        await Insumo.create({
          nombre: p.nombre, familia: p.familia,
          familia_abrev: p.familia_abrev.toUpperCase(),
          especificaciones: p.especificaciones,
          estado: 'activo', cantidad_disponible: 1,
          ambulanciaId: amb.id,
          fecha_registro: new Date(),
          codigo_qr: codigo,
          codigo,
        });
        ambCount++;
      }
    }
    console.log(`[DB] ✓ Insumos creados para AMB-${num} (${ambCount} insumos)`);
  }
}

async function init() {
  try {
    await crearBaseDeDatos();
    await sincronizarTablas();
    console.log('[DB] ✅ Inicialización completada exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('[DB] ❌ Error durante la inicialización:', error.message);
    console.error(error);
    process.exit(1);
  }
}

init();
