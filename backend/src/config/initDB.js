// Inicialización completa: BD → tablas → migraciones → seeds
require('dotenv').config();
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const DB_NAME     = process.env.DB_NAME || 'MedicalInventary';
const DB_USER     = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_HOST     = process.env.DB_HOST;
const DB_PORT     = parseInt(process.env.DB_PORT) || 1433;

async function crearBaseDeDatos() {
  console.log('[DB] Conectando al servidor SQL Server (master)...');
  const seqMaster = new Sequelize('master', DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: DB_PORT,
    dialect: 'mssql',
    dialectOptions: {
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
        instanceName: process.env.DB_INSTANCE || undefined,
      },
    },
    logging: false,
  });

  await seqMaster.authenticate();
  console.log('[DB] Conexión a master exitosa.');

  const [results] = await seqMaster.query(
    `SELECT name FROM sys.databases WHERE name = '${DB_NAME}'`
  );
  if (results.length === 0) {
    console.log(`[DB] Creando base de datos "${DB_NAME}"...`);
    await seqMaster.query(`CREATE DATABASE [${DB_NAME}]`);
    console.log(`[DB] Base de datos "${DB_NAME}" creada.`);
  } else {
    console.log(`[DB] Base de datos "${DB_NAME}" ya existe.`);
  }

  await seqMaster.close();
}

// Helper: agrega columna a una tabla si no existe
async function agregarColumna(sequelize, tabla, columna, definicion) {
  const [rows] = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = '${tabla}' AND COLUMN_NAME = '${columna}'`
  );
  if (rows.length === 0) {
    console.log(`[DB] Agregando columna ${columna} a ${tabla}...`);
    await sequelize.query(`ALTER TABLE [${tabla}] ADD [${columna}] ${definicion}`);
    console.log(`[DB] ✓ ${columna} agregada.`);
  }
}

async function sincronizarTablas() {
  console.log('[DB] Conectando a la base de datos...');
  const {
    sequelize, Role, Usuario, Ambulancia, Insumo, MovimientoInventario, ContadorCodigo,
  } = require('../models');

  await sequelize.authenticate();
  console.log('[DB] Conexión exitosa.');

  // Sincroniza: crea tablas nuevas, no altera las existentes
  console.log('[DB] Sincronizando tablas...');
  await sequelize.sync({ force: false });
  console.log('[DB] Tablas sincronizadas.');

  // ── Migraciones: tabla Usuarios ───────────────────────────────────────────
  await agregarColumna(sequelize, 'Usuarios', 'ambulanciaId',
    'INT NULL REFERENCES [Ambulancias]([id])');
  await agregarColumna(sequelize, 'Usuarios', 'cedula', 'NVARCHAR(15) NULL');
  await agregarColumna(sequelize, 'Usuarios', 'numero_ambulancia', 'NVARCHAR(50) NULL');

  // Índice único en cedula (filtrado: solo filas no-NULL)
  const [idxCedula] = await sequelize.query(
    `SELECT i.name FROM sys.indexes i
     JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
     JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
     WHERE i.object_id = OBJECT_ID('Usuarios') AND c.name = 'cedula' AND i.is_unique = 1`
  );
  if (idxCedula.length === 0) {
    await sequelize.query(
      `CREATE UNIQUE INDEX [Usuarios_cedula] ON [Usuarios]([cedula]) WHERE [cedula] IS NOT NULL`
    );
    console.log('[DB] Índice único en cedula creado.');
  }

  // ── Migraciones: tabla Insumos ─────────────────────────────────────────────
  const columnasInsumos = [
    { name: 'cantidad_disponible', sql: '[cantidad_disponible] INT NOT NULL DEFAULT 1' },
    { name: 'estado',              sql: "[estado] VARCHAR(20) NOT NULL DEFAULT 'activo'" },
    { name: 'codigo_qr',           sql: '[codigo_qr] VARCHAR(255) NULL' },
    { name: 'imagen_ruta',         sql: '[imagen_ruta] VARCHAR(500) NULL' },
    { name: 'fecha_registro',      sql: '[fecha_registro] DATETIME NULL' },
    { name: 'observaciones',       sql: '[observaciones] VARCHAR(500) NULL' },
    // Nuevas columnas v2
    { name: 'codigo',              sql: '[codigo] VARCHAR(20) NULL' },
    { name: 'familia',             sql: '[familia] VARCHAR(50) NULL' },
    { name: 'familia_abrev',       sql: '[familia_abrev] VARCHAR(5) NULL' },
    { name: 'especificaciones',    sql: '[especificaciones] VARCHAR(500) NULL' },
    { name: 'ambulanciaId',        sql: '[ambulanciaId] INT NULL' },
  ];

  for (const col of columnasInsumos) {
    await agregarColumna(sequelize, 'Insumos', col.name, col.sql);
  }

  // Poblar codigo_qr con UUID para insumos legacy que tengan NULL
  const [sinQR] = await sequelize.query(`SELECT id FROM [Insumos] WHERE [codigo_qr] IS NULL`);
  for (const row of sinQR) {
    await sequelize.query(
      `UPDATE [Insumos] SET [codigo_qr] = ? WHERE id = ?`,
      { replacements: [crypto.randomUUID(), row.id] }
    );
  }
  if (sinQR.length > 0) console.log(`[DB] UUID generado para ${sinQR.length} insumo(s) sin QR.`);

  // Índice único en codigo_qr
  const [idxQR] = await sequelize.query(
    `SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('Insumos') AND name = 'UQ_Insumos_CodigoQR'`
  );
  if (idxQR.length === 0) {
    await sequelize.query(
      `CREATE UNIQUE INDEX [UQ_Insumos_CodigoQR] ON [Insumos]([codigo_qr]) WHERE [codigo_qr] IS NOT NULL`
    );
    console.log('[DB] Índice único en codigo_qr creado.');
  }

  // Índice único en codigo (nuevo formato INS-FAM-###)
  const [idxCodigo] = await sequelize.query(
    `SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('Insumos') AND name = 'UQ_Insumos_Codigo'`
  );
  if (idxCodigo.length === 0) {
    await sequelize.query(
      `CREATE UNIQUE INDEX [UQ_Insumos_Codigo] ON [Insumos]([codigo]) WHERE [codigo] IS NOT NULL`
    );
    console.log('[DB] Índice único en codigo creado.');
  }

  // ── Inicializar ContadorCodigo ─────────────────────────────────────────────
  const [contRows] = await sequelize.query(`SELECT COUNT(1) AS cnt FROM [ContadorCodigo]`);
  if ((contRows[0]?.cnt ?? 0) == 0) {
    await sequelize.query(`INSERT INTO [ContadorCodigo] ([valor]) VALUES (0)`);
    console.log('[DB] Contador de códigos inicializado.');
  }

  // ── Seed: 10 ambulancias AMB-01 a AMB-10 ──────────────────────────────────
  console.log('[DB] Verificando ambulancias...');
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

  // ── Seed: usuario admin por defecto ───────────────────────────────────────
  const adminExiste = await Usuario.findOne({ where: { cedula: '0000000001' } });
  if (!adminExiste) {
    const passwordHash = await bcrypt.hash('Admin123!', 12);
    await Usuario.create({
      nombre: 'Administrador',
      cedula: '0000000001',
      numero_ambulancia: 'ADMIN-CENTRAL',
      password: passwordHash,
      roleId: 1,
      activo: true,
    });
    console.log('[DB] Admin creado — Cédula: 0000000001 / Pass: Admin123!');
  }

  // ── Seed: usuario de prueba ────────────────────────────────────────────────
  const testExiste = await Usuario.findOne({ where: { cedula: '1234567890' } });
  if (!testExiste) {
    const passwordHash = await bcrypt.hash('Test1234!', 12);
    await Usuario.create({
      nombre: 'Usuario Prueba Ambulancia',
      cedula: '1234567890',
      numero_ambulancia: 'AMB-01',
      password: passwordHash,
      roleId: 2,
      activo: true,
    });
    console.log('[DB] Usuario prueba creado — Cédula: 1234567890 / Pass: Test1234!');
  }

  await sequelize.close();
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
