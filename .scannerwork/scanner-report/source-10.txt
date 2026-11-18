// Seed: stock inicial de insumos para AMB-01 a AMB-10
require('dotenv').config();

const STOCK_POR_AMBULANCIA = [
  { nombre: 'Collar cervical adulto',              familia: 'Collares',       familia_abrev: 'COL', cantidad: 3 },
  { nombre: 'Collar cervical pediátrico',          familia: 'Collares',       familia_abrev: 'COL', cantidad: 2 },
  { nombre: 'Tabla espinal larga / Camilla Baxtrap', familia: 'Inmovilización', familia_abrev: 'INM', cantidad: 1 },
  { nombre: 'Pinza Rochester',                     familia: 'Instrumental',   familia_abrev: 'INS', cantidad: 4 },
  { nombre: 'Araña',                               familia: 'Inmovilización', familia_abrev: 'INM', cantidad: 1 },
  { nombre: 'Bloques laterales',                   familia: 'Inmovilización', familia_abrev: 'INM', cantidad: 2 },
];

async function siguienteContador(sequelize, t) {
  const [rows] = await sequelize.query(
    `SELECT [valor] FROM [ContadorCodigo] WITH (UPDLOCK) WHERE [id] = 1`,
    { transaction: t }
  );
  const siguiente = (rows[0]?.valor ?? 0) + 1;
  await sequelize.query(
    `UPDATE [ContadorCodigo] SET [valor] = :val WHERE [id] = 1`,
    { replacements: { val: siguiente }, transaction: t }
  );
  return siguiente;
}

function formatFecha(date) {
  const d = new Date(date);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}-${mes}-${d.getFullYear()}`;
}

async function seedStock() {
  const { sequelize, Insumo, Ambulancia, ContadorCodigo } = require('../models');

  await sequelize.authenticate();
  console.log('[SEED-STOCK] Conexión exitosa a la base de datos.');

  // Crear tabla ContadorCodigo si no existe y asegurar que tenga la fila id=1
  await sequelize.query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'ContadorCodigo'
    )
    CREATE TABLE [ContadorCodigo] (
      [id]    INT IDENTITY(1,1) PRIMARY KEY,
      [valor] INT NOT NULL DEFAULT 0
    )
  `);

  const [contadorRows] = await sequelize.query(
    `SELECT [id] FROM [ContadorCodigo] WHERE [id] = 1`
  );
  if (contadorRows.length === 0) {
    await sequelize.query(`INSERT INTO [ContadorCodigo] ([valor]) VALUES (0)`);
    console.log('[SEED-STOCK] ContadorCodigo inicializado en 0.');
  }

  // Migrar tabla Insumos: agregar columnas nuevas si no existen
  async function addColIfMissing(tabla, columna, definicion) {
    const [rows] = await sequelize.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tabla}' AND COLUMN_NAME = '${columna}'
    `);
    if (rows.length === 0) {
      await sequelize.query(`ALTER TABLE [${tabla}] ADD [${columna}] ${definicion}`);
      console.log(`[SEED-STOCK] Columna "${columna}" agregada a ${tabla}.`);
    }
  }

  await addColIfMissing('Insumos', 'codigo',           'VARCHAR(20) NULL');
  await addColIfMissing('Insumos', 'familia',          'VARCHAR(50) NULL');
  await addColIfMissing('Insumos', 'familia_abrev',    'VARCHAR(5) NULL');
  await addColIfMissing('Insumos', 'especificaciones', 'VARCHAR(500) NULL');
  await addColIfMissing('Insumos', 'ambulanciaId',     'INT NULL');

  // Índice único filtrado en Insumos.codigo
  const [idxCodigo] = await sequelize.query(`
    SELECT name FROM sys.indexes
    WHERE object_id = OBJECT_ID('Insumos') AND name = 'UQ_Insumos_Codigo'
  `);
  if (idxCodigo.length === 0) {
    await sequelize.query(
      `CREATE UNIQUE INDEX [UQ_Insumos_Codigo] ON [Insumos]([codigo]) WHERE [codigo] IS NOT NULL`
    );
    console.log('[SEED-STOCK] Índice filtrado en Insumos.codigo creado.');
  }

  // Arreglar índices UNIQUE en Ambulancias.placa:
  // SQL Server no permite múltiples NULLs en índice UNIQUE no filtrado.
  // Eliminamos cualquier constraint o índice existente en placa y creamos uno filtrado.
  const [constraintRows] = await sequelize.query(`
    SELECT tc.CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
      ON tc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
    WHERE tc.TABLE_NAME = 'Ambulancias'
      AND ccu.COLUMN_NAME = 'placa'
      AND tc.CONSTRAINT_TYPE = 'UNIQUE'
  `);
  for (const row of constraintRows) {
    await sequelize.query(`ALTER TABLE [Ambulancias] DROP CONSTRAINT [${row.CONSTRAINT_NAME}]`);
    console.log(`[SEED-STOCK] Constraint "${row.CONSTRAINT_NAME}" eliminado.`);
  }
  // Eliminar cualquier índice no filtrado en placa (incluye el creado por Sequelize)
  const [allIdxPlaca] = await sequelize.query(`
    SELECT i.name
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('Ambulancias')
      AND c.name = 'placa'
      AND i.is_unique = 1
      AND i.has_filter = 0
  `);
  for (const row of allIdxPlaca) {
    await sequelize.query(`DROP INDEX [${row.name}] ON [Ambulancias]`);
    console.log(`[SEED-STOCK] Índice "${row.name}" eliminado de Ambulancias.placa.`);
  }
  // Crear índice filtrado único (ignora filas donde placa IS NULL)
  const [idxFiltrado] = await sequelize.query(`
    SELECT name FROM sys.indexes
    WHERE object_id = OBJECT_ID('Ambulancias') AND name = 'UQ_Ambulancias_placa_filtered'
  `);
  if (idxFiltrado.length === 0) {
    await sequelize.query(
      `CREATE UNIQUE INDEX [UQ_Ambulancias_placa_filtered]
       ON [Ambulancias]([placa]) WHERE [placa] IS NOT NULL`
    );
    console.log('[SEED-STOCK] Índice filtrado en Ambulancias.placa creado.');
  }

  // Crear ambulancias AMB-01 a AMB-10 si no existen (via SQL para evitar constraint NULL en placa)
  const now = new Date().toISOString();
  for (let i = 1; i <= 10; i++) {
    const cod = `AMB-${String(i).padStart(2, '0')}`;
    const [ya] = await sequelize.query(
      `SELECT [id] FROM [Ambulancias] WHERE [codigo] = :cod`,
      { replacements: { cod } }
    );
    if (ya.length === 0) {
      await sequelize.query(
        `INSERT INTO [Ambulancias] ([codigo],[descripcion],[activa],[createdAt],[updatedAt])
         VALUES (:cod, :desc, 1, :now, :now)`,
        { replacements: { cod, desc: `Ambulancia ${cod}`, now } }
      );
      console.log(`[SEED-STOCK]   ✓ Ambulancia creada: ${cod}`);
    }
  }

  // Cargar ambulancias AMB-01 a AMB-10
  const ambulancias = await Ambulancia.findAll({
    where: { activa: true },
    order: [['codigo', 'ASC']],
  });

  const ambMap = {};
  for (const a of ambulancias) ambMap[a.codigo] = a;

  let totalCreados = 0;
  let primerCodigo = null;
  let ultimoCodigo = null;

  for (let i = 1; i <= 10; i++) {
    const ambCodigo = `AMB-${String(i).padStart(2, '0')}`;
    const ambulancia = ambMap[ambCodigo];

    const t = await sequelize.transaction();
    let creadosEnAmb = 0;

    try {
      for (const item of STOCK_POR_AMBULANCIA) {
        for (let u = 0; u < item.cantidad; u++) {
          const num = await siguienteContador(sequelize, t);
          const codigo = `INS-${item.familia_abrev.toUpperCase()}-${String(num).padStart(3, '0')}`;
          const ahora = new Date().toISOString();

          await sequelize.query(`
            INSERT INTO [Insumos]
              ([codigo],[nombre],[familia],[familia_abrev],[estado],
               [ambulanciaId],[cantidad_disponible],[codigo_qr],
               [fecha_registro],[createdAt],[updatedAt])
            VALUES
              (:codigo,:nombre,:familia,:familia_abrev,:estado,
               :ambulanciaId,1,:codigo,
               :ahora,:ahora,:ahora)
          `, {
            replacements: {
              codigo,
              nombre: item.nombre,
              familia: item.familia,
              familia_abrev: item.familia_abrev.toUpperCase(),
              estado: 'activo',
              ambulanciaId: ambulancia.id,
              ahora,
            },
            transaction: t,
          });

          if (!primerCodigo) primerCodigo = codigo;
          ultimoCodigo = codigo;
          creadosEnAmb++;
        }
      }

      await t.commit();
      totalCreados += creadosEnAmb;
      console.log(`[SEED-STOCK]   ✓ ${ambCodigo}: ${creadosEnAmb} insumos creados`);
    } catch (err) {
      await t.rollback();
      const msg = err.parent?.message || err.original?.message || err.message || JSON.stringify(err);
      console.error(`[SEED-STOCK]   ❌ Error en ${ambCodigo}: ${msg}`);
      await sequelize.close();
      process.exit(1);
    }
  }

  const hoy = formatFecha(new Date());
  console.log('');
  console.log('[SEED-STOCK] ══════════════════════════════════════════');
  console.log(`[SEED-STOCK]  Total insumos creados : ${totalCreados}`);
  console.log(`[SEED-STOCK]  Primer código         : ${primerCodigo}`);
  console.log(`[SEED-STOCK]  Último código          : ${ultimoCodigo}`);
  console.log(`[SEED-STOCK]  Fecha de registro      : ${hoy}`);
  console.log('[SEED-STOCK] ══════════════════════════════════════════');

  await sequelize.close();
}

seedStock()
  .then(() => {
    console.log('[SEED-STOCK] ✅ Seed de stock completado.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[SEED-STOCK] ❌ Error inesperado:', err.message);
    console.error(err);
    process.exit(1);
  });
