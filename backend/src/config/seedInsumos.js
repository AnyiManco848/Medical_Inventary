// Script independiente: migra tabla Insumos y siembra los 6 insumos médicos
// No depende de sequelize.sync() — trabaja directamente con SQL para evitar
// conflictos de índices en otras tablas.
require('dotenv').config();
const { Sequelize } = require('sequelize');
const crypto = require('crypto');

const DB_NAME     = process.env.DB_NAME     || 'MedicalInventary';
const DB_USER     = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_HOST     = process.env.DB_HOST;
const DB_PORT     = parseInt(process.env.DB_PORT) || 1433;

const seq = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host:    DB_HOST,
  port:    DB_PORT,
  dialect: 'mssql',
  dialectOptions: {
    options: {
      encrypt:                process.env.DB_ENCRYPT   === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
      instanceName:           process.env.DB_INSTANCE  || undefined,
    },
  },
  logging: (msg) => console.log('[SQL]', msg),
});

async function run() {
  await seq.authenticate();
  console.log('\n[DB] Conectado a', DB_NAME);

  // ── 1. Mostrar columnas reales de Insumos ──────────────────────────────────
  const [columnas] = await seq.query(
    `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'Insumos'
     ORDER BY ORDINAL_POSITION`
  );

  if (columnas.length === 0) {
    console.log('\n[DB] La tabla Insumos no existe. Créala ejecutando:');
    console.log('     npm run db:init   O   backend/sql/inventario.sql en SSMS');
    await seq.close(); return;
  }

  console.log('\n[DB] Estructura actual de Insumos:');
  columnas.forEach(c =>
    console.log(`  · ${c.COLUMN_NAME.padEnd(25)} ${c.DATA_TYPE.padEnd(15)} NULL:${c.IS_NULLABLE}`)
  );

  const colNames = columnas.map(c => c.COLUMN_NAME.toLowerCase());

  // ── 2. Agregar columnas faltantes ──────────────────────────────────────────
  const necesarias = [
    { name: 'cantidad_disponible', sql: '[cantidad_disponible] INT NOT NULL DEFAULT 0' },
    { name: 'estado',              sql: "[estado] VARCHAR(20) NOT NULL DEFAULT 'activo'" },
    { name: 'codigo_qr',          sql: '[codigo_qr] VARCHAR(255) NULL' },
    { name: 'imagen_ruta',        sql: '[imagen_ruta] VARCHAR(500) NULL' },
    { name: 'fecha_registro',     sql: '[fecha_registro] DATETIME NOT NULL DEFAULT GETDATE()' },
    { name: 'observaciones',      sql: '[observaciones] VARCHAR(500) NULL' },
  ];

  for (const col of necesarias) {
    if (!colNames.includes(col.name)) {
      console.log(`\n[DB] Agregando columna ${col.name}...`);
      await seq.query(`ALTER TABLE [Insumos] ADD ${col.sql}`);
      console.log(`[DB] ✓ ${col.name} agregada`);
    }
  }

  // ── 3. Crear tabla MovimientosInventario si no existe ─────────────────────
  const [tablasMov] = await seq.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_NAME = 'MovimientosInventario'`
  );
  if (tablasMov.length === 0) {
    console.log('\n[DB] Creando tabla MovimientosInventario...');
    await seq.query(`
      CREATE TABLE [dbo].[MovimientosInventario] (
        [id_movimiento]     INT          IDENTITY(1,1) NOT NULL,
        [id_insumo]         INT          NOT NULL,
        [tipo]              VARCHAR(10)  NOT NULL,
        [cantidad]          INT          NOT NULL,
        [fecha]             DATETIME     NOT NULL DEFAULT GETDATE(),
        [usuario]           VARCHAR(100) NOT NULL,
        [numero_ambulancia] VARCHAR(50)  NULL,
        [motivo]            VARCHAR(255) NULL,
        CONSTRAINT PK_MovimientosInventario PRIMARY KEY ([id_movimiento]),
        CONSTRAINT CK_Movimientos_Tipo CHECK ([tipo] IN ('entrada','salida')),
        CONSTRAINT FK_Movimientos_Insumo FOREIGN KEY ([id_insumo]) REFERENCES [dbo].[Insumos]([id])
      )
    `);
    await seq.query(`CREATE INDEX IX_Mov_Insumo ON [MovimientosInventario]([id_insumo])`);
    console.log('[DB] ✓ MovimientosInventario creada');
  } else {
    console.log('[DB] MovimientosInventario ya existe');
  }

  // ── 4. Poblar codigo_qr NULLs ─────────────────────────────────────────────
  const [sinQR] = await seq.query(`SELECT id FROM [Insumos] WHERE [codigo_qr] IS NULL`);
  for (const row of sinQR) {
    await seq.query(
      `UPDATE [Insumos] SET [codigo_qr] = ? WHERE id = ?`,
      { replacements: [crypto.randomUUID(), row.id] }
    );
  }
  if (sinQR.length > 0) console.log(`\n[DB] UUID generado para ${sinQR.length} insumo(s) sin QR`);

  // ── 5. Índice único parcial en codigo_qr ──────────────────────────────────
  const [idxQR] = await seq.query(
    `SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('Insumos') AND name = 'UQ_Insumos_CodigoQR'`
  );
  if (idxQR.length === 0) {
    await seq.query(
      `CREATE UNIQUE INDEX [UQ_Insumos_CodigoQR] ON [Insumos]([codigo_qr]) WHERE [codigo_qr] IS NOT NULL`
    );
    console.log('[DB] ✓ Índice único en codigo_qr creado');
  }

  // ── 6. Insertar los 6 insumos médicos (si no existen ya) ──────────────────
  const semilla = [
    { nombre: 'Baxstrap', cantidad: 6  },
    { nombre: 'Bloque',   cantidad: 6  },
    { nombre: 'Botiquin', cantidad: 16 },
    { nombre: 'Araña',    cantidad: 12 },
    { nombre: 'Collar',   cantidad: 14 },
    { nombre: 'Estuche',  cantidad: 17 },
  ];

  console.log('\n[DB] Insertando insumos médicos...');
  let insertados = 0;
  for (const item of semilla) {
    const [existe] = await seq.query(
      `SELECT id FROM [Insumos] WHERE [nombre] = ?`,
      { replacements: [item.nombre] }
    );
    if (existe.length === 0) {
      // createdAt/updatedAt son datetimeoffset NOT NULL (Sequelize los gestiona así en MSSQL)
      await seq.query(
        `INSERT INTO [Insumos] ([nombre],[cantidad_disponible],[estado],[codigo_qr],[createdAt],[updatedAt])
         VALUES (?, ?, 'activo', ?, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET())`,
        { replacements: [item.nombre, item.cantidad, crypto.randomUUID()] }
      );
      console.log(`  ✓ Insertado: ${item.nombre} (cantidad: ${item.cantidad})`);
      insertados++;
    } else {
      console.log(`  · Ya existe: ${item.nombre}`);
    }
  }
  console.log(`\n[DB] ${insertados} insumo(s) nuevo(s) insertado(s)`);

  // ── 7. SELECT de verificación ──────────────────────────────────────────────
  const [insumos] = await seq.query(
    `SELECT id, nombre, cantidad_disponible, estado,
            CASE WHEN codigo_qr IS NULL THEN 'NULL' ELSE 'OK' END AS tiene_qr,
            CASE WHEN imagen_ruta IS NULL THEN 'NULL' ELSE imagen_ruta END AS imagen
     FROM [Insumos]
     ORDER BY nombre`
  );

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  SELECT de verificación — tabla Insumos');
  console.log('══════════════════════════════════════════════════════');
  console.log(`${'ID'.padEnd(5)} ${'Nombre'.padEnd(15)} ${'Cantidad'.padEnd(10)} ${'Estado'.padEnd(15)} ${'QR'.padEnd(6)} Imagen`);
  console.log('─'.repeat(70));
  insumos.forEach(r =>
    console.log(
      `${String(r.id).padEnd(5)} ${r.nombre.padEnd(15)} ${String(r.cantidad_disponible).padEnd(10)} ${r.estado.padEnd(15)} ${r.tiene_qr.padEnd(6)} ${r.imagen}`
    )
  );
  console.log('══════════════════════════════════════════════════════');
  console.log(`Total: ${insumos.length} insumo(s)\n`);

  await seq.close();
  console.log('[DB] ✅ Completado exitosamente');
}

run().catch(err => {
  console.error('\n[DB] ❌ Error:', err.message);
  console.error(err);
  process.exit(1);
});
