// Script de inicialización de base de datos
// Crea la BD MedicalInventary si no existe, luego sincroniza tablas e inserta datos iniciales
require('dotenv').config();
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const DB_NAME = process.env.DB_NAME || 'MedicalInventary';
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_HOST = process.env.DB_HOST;
const DB_PORT = parseInt(process.env.DB_PORT) || 1433;

// Paso 1: Conectar al servidor sin especificar base de datos (usando 'master')
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

  // Verificar si la BD ya existe
  const [results] = await seqMaster.query(
    `SELECT name FROM sys.databases WHERE name = '${DB_NAME}'`
  );

  if (results.length === 0) {
    console.log(`[DB] Creando base de datos "${DB_NAME}"...`);
    await seqMaster.query(`CREATE DATABASE [${DB_NAME}]`);
    console.log(`[DB] Base de datos "${DB_NAME}" creada exitosamente.`);
  } else {
    console.log(`[DB] Base de datos "${DB_NAME}" ya existe. Continuando...`);
  }

  await seqMaster.close();
}

// Paso 2: Sincronizar modelos y cargar datos iniciales
async function sincronizarTablas() {
  console.log('[DB] Conectando a la base de datos MedicalInventary...');

  // Importar modelos (ya configurados con la BD correcta)
  const { sequelize, Role, Usuario, Insumo, MovimientoInventario } = require('../models');

  await sequelize.authenticate();
  console.log('[DB] Conexión a MedicalInventary exitosa.');

  // Crear tablas nuevas que no existan — no alterar las existentes
  // (alter: true tiene incompatibilidades con SQL Server para columnas con DEFAULT)
  console.log('[DB] Sincronizando tablas (force: false)...');
  await sequelize.sync({ force: false });
  console.log('[DB] Tablas sincronizadas correctamente.');

  // ── Migraciones manuales ──────────────────────────────────────────────────

  // Migración: agregar columna ambulanciaId a Usuarios si no existe
  console.log('[DB] Verificando columna ambulanciaId en Usuarios...');
  const [colsAmbulanciaId] = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'Usuarios' AND COLUMN_NAME = 'ambulanciaId'`
  );
  if (colsAmbulanciaId.length === 0) {
    console.log('[DB] Agregando columna ambulanciaId...');
    await sequelize.query(
      `ALTER TABLE [Usuarios] ADD [ambulanciaId] INT NULL
       REFERENCES [Ambulancias]([id])`
    );
    console.log('[DB] Columna ambulanciaId agregada correctamente.');
  } else {
    console.log('[DB] Columna ambulanciaId ya existe, omitiendo.');
  }

  // Migración: agregar columna cedula a Usuarios si no existe
  console.log('[DB] Verificando columna cedula en Usuarios...');
  const [colsCedula] = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'Usuarios' AND COLUMN_NAME = 'cedula'`
  );
  if (colsCedula.length === 0) {
    console.log('[DB] Agregando columna cedula...');
    // Agregar como NULL para evitar conflictos con filas existentes; la app valida NOT NULL
    await sequelize.query(
      `ALTER TABLE [Usuarios] ADD [cedula] NVARCHAR(15) NULL`
    );
    console.log('[DB] Columna cedula agregada correctamente.');
  } else {
    console.log('[DB] Columna cedula ya existe, omitiendo.');
  }

  // Migración: agregar columna numero_ambulancia a Usuarios si no existe
  console.log('[DB] Verificando columna numero_ambulancia en Usuarios...');
  const [colsNumAmb] = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'Usuarios' AND COLUMN_NAME = 'numero_ambulancia'`
  );
  if (colsNumAmb.length === 0) {
    console.log('[DB] Agregando columna numero_ambulancia...');
    await sequelize.query(
      `ALTER TABLE [Usuarios] ADD [numero_ambulancia] NVARCHAR(50) NULL`
    );
    console.log('[DB] Columna numero_ambulancia agregada correctamente.');
  } else {
    console.log('[DB] Columna numero_ambulancia ya existe, omitiendo.');
  }

  // Migración: eliminar índice único de email si existe (ya no es el identificador de login)
  console.log('[DB] Verificando índice único de email en Usuarios...');
  const [idxEmail] = await sequelize.query(
    `SELECT i.name FROM sys.indexes i
     JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
     JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
     WHERE i.object_id = OBJECT_ID('Usuarios') AND c.name = 'email' AND i.is_unique = 1`
  );
  if (idxEmail.length > 0) {
    const indexName = idxEmail[0].name;
    console.log(`[DB] Eliminando índice único de email: ${indexName}...`);
    await sequelize.query(`DROP INDEX [${indexName}] ON [Usuarios]`);
    console.log('[DB] Índice único de email eliminado.');
  } else {
    console.log('[DB] No existe índice único de email, omitiendo.');
  }

  // Migración: crear índice único en cedula si no existe
  console.log('[DB] Verificando índice único de cedula en Usuarios...');
  const [idxCedula] = await sequelize.query(
    `SELECT i.name FROM sys.indexes i
     JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
     JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
     WHERE i.object_id = OBJECT_ID('Usuarios') AND c.name = 'cedula' AND i.is_unique = 1`
  );
  if (idxCedula.length === 0) {
    console.log('[DB] Creando índice único en cedula...');
    // El índice solo puede ser UNIQUE sobre valores no nulos; filas con cedula NULL quedarán fuera
    await sequelize.query(
      `CREATE UNIQUE INDEX [Usuarios_cedula] ON [Usuarios]([cedula])
       WHERE [cedula] IS NOT NULL`
    );
    console.log('[DB] Índice único en cedula creado correctamente.');
  } else {
    console.log('[DB] Índice único de cedula ya existe, omitiendo.');
  }

  // ── Migraciones de Insumos ────────────────────────────────────────────────

  const columnasInsumos = [
    { name: 'cantidad_disponible', sql: '[cantidad_disponible] INT NOT NULL DEFAULT 0' },
    { name: 'estado',              sql: "[estado] VARCHAR(20) NOT NULL DEFAULT 'activo'" },
    { name: 'codigo_qr',           sql: '[codigo_qr] VARCHAR(255) NULL' },
    { name: 'imagen_ruta',         sql: '[imagen_ruta] VARCHAR(500) NULL' },
    { name: 'fecha_registro',      sql: '[fecha_registro] DATETIME NOT NULL DEFAULT GETDATE()' },
    { name: 'observaciones',       sql: '[observaciones] VARCHAR(500) NULL' },
  ];

  for (const col of columnasInsumos) {
    const [rows] = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = 'Insumos' AND COLUMN_NAME = '${col.name}'`
    );
    if (rows.length === 0) {
      console.log(`[DB] Agregando columna ${col.name} a Insumos...`);
      await sequelize.query(`ALTER TABLE [Insumos] ADD ${col.sql}`);
    }
  }

  // Poblar codigo_qr con UUID para insumos existentes que tengan NULL
  const [sinQR] = await sequelize.query(
    `SELECT id FROM [Insumos] WHERE [codigo_qr] IS NULL`
  );
  for (const row of sinQR) {
    await sequelize.query(
      `UPDATE [Insumos] SET [codigo_qr] = ? WHERE id = ?`,
      { replacements: [crypto.randomUUID(), row.id] }
    );
  }
  if (sinQR.length > 0) {
    console.log(`[DB] Código QR generado para ${sinQR.length} insumo(s) existente(s).`);
  }

  // Crear índice único en codigo_qr si no existe
  const [idxQR] = await sequelize.query(
    `SELECT i.name FROM sys.indexes i WHERE i.object_id = OBJECT_ID('Insumos') AND i.name = 'UQ_Insumos_CodigoQR'`
  );
  if (idxQR.length === 0) {
    await sequelize.query(
      `CREATE UNIQUE INDEX [UQ_Insumos_CodigoQR] ON [Insumos]([codigo_qr]) WHERE [codigo_qr] IS NOT NULL`
    );
    console.log('[DB] Índice único en codigo_qr creado.');
  }

  // ── Seeds de insumos iniciales ─────────────────────────────────────────────
  const insumosIniciales = [
    { nombre: 'Baxstrap', cantidad_disponible: 6 },
    { nombre: 'Bloque',   cantidad_disponible: 6 },
    { nombre: 'Botiquín', cantidad_disponible: 16 },
    { nombre: 'Araña',    cantidad_disponible: 12 },
    { nombre: 'Collar',   cantidad_disponible: 14 },
    { nombre: 'Estuche',  cantidad_disponible: 17 },
  ];

  for (const datos of insumosIniciales) {
    const existe = await Insumo.findOne({ where: { nombre: datos.nombre } });
    if (!existe) {
      await Insumo.create({
        ...datos,
        estado: 'activo',
        codigo_qr: crypto.randomUUID(),
      });
      console.log(`[DB] Insumo insertado: ${datos.nombre}`);
    }
  }

  // ── Seeds ─────────────────────────────────────────────────────────────────

  // Insertar roles iniciales si no existen
  const countRoles = await Role.count();
  if (countRoles === 0) {
    console.log('[DB] Insertando roles iniciales...');
    await Role.bulkCreate([
      { nombre: 'admin', descripcion: 'Administrador del sistema' },
      { nombre: 'ambulancia', descripcion: 'Personal de ambulancia' },
    ]);
    console.log('[DB] Roles creados: admin, ambulancia.');
  } else {
    console.log('[DB] Roles ya existen, omitiendo inserción.');
  }

  // Insertar usuario admin por defecto si no existe (buscado por cédula)
  const adminExiste = await Usuario.findOne({ where: { cedula: '0000000001' } });
  if (!adminExiste) {
    console.log('[DB] Creando usuario admin por defecto...');
    const passwordHash = await bcrypt.hash('Admin123!', 12);
    await Usuario.create({
      nombre: 'Administrador',
      cedula: '0000000001',
      numero_ambulancia: 'ADMIN-CENTRAL',
      email: 'admin@medical.com',  // conservado como referencia histórica
      password: passwordHash,
      roleId: 1,
      activo: true,
    });
    console.log('[DB] Usuario admin creado:');
    console.log('[DB]   Cédula:            0000000001');
    console.log('[DB]   Núm. ambulancia:   ADMIN-CENTRAL');
    console.log('[DB]   Contraseña:        Admin123!');
  } else {
    console.log('[DB] Usuario admin ya existe, omitiendo inserción.');
  }

  // Insertar usuario de prueba con rol ambulancia si no existe
  const testUserExiste = await Usuario.findOne({ where: { cedula: '1234567890' } });
  if (!testUserExiste) {
    console.log('[DB] Creando usuario de prueba (rol ambulancia)...');
    const passwordHash = await bcrypt.hash('Test1234!', 12);
    await Usuario.create({
      nombre: 'Usuario Prueba Ambulancia',
      cedula: '1234567890',
      numero_ambulancia: 'AMB-01',
      password: passwordHash,
      roleId: 2,
      activo: true,
    });
    console.log('[DB] Usuario de prueba creado:');
    console.log('[DB]   Cédula:            1234567890');
    console.log('[DB]   Núm. ambulancia:   AMB-01');
    console.log('[DB]   Contraseña:        Test1234!');
  } else {
    console.log('[DB] Usuario de prueba ya existe, omitiendo inserción.');
  }

  await sequelize.close();
}

// Ejecutar inicialización completa
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
