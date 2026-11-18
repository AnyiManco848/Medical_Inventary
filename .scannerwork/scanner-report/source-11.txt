// Seed completo de usuarios: limpia BD y crea los 22 usuarios del sistema
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, Role, Usuario, Ambulancia } = require('../models');

async function seedUsuarios() {
  await sequelize.authenticate();
  console.log('[SEED] Conectado a la base de datos.');

  // ── a) Eliminar columna cedula si existe ──────────────────────────────────
  const [colCedula] = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = 'Usuarios' AND COLUMN_NAME = 'cedula'`
  );

  if (colCedula.length > 0) {
    // Eliminar cualquier índice sobre cedula antes de dropear la columna
    const [idxsCedula] = await sequelize.query(
      `SELECT i.name FROM sys.indexes i
       JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
       JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
       WHERE i.object_id = OBJECT_ID('Usuarios') AND c.name = 'cedula'`
    );
    for (const idx of idxsCedula) {
      await sequelize.query(`DROP INDEX [${idx.name}] ON [Usuarios]`);
      console.log(`[SEED] Índice ${idx.name} (cedula) eliminado.`);
    }
    await sequelize.query(`ALTER TABLE [Usuarios] DROP COLUMN [cedula]`);
    console.log('[SEED] Columna cedula eliminada.');
  } else {
    console.log('[SEED] Columna cedula no existe (ya fue eliminada).');
  }

  // ── b) Eliminar todos los usuarios (y dependencias en Trazabilidad) ───────
  try {
    await sequelize.query(`DELETE FROM [Trazabilidad]`);
    console.log('[SEED] Trazabilidad limpiada.');
  } catch (_) { /* sin registros o sin FK */ }

  await sequelize.query(`DELETE FROM [Usuarios]`);
  console.log('[SEED] Usuarios existentes eliminados.');

  // ── c) Crear índice único sobre numero_ambulancia si no existe ─────────────
  const [idxsNumAmb] = await sequelize.query(
    `SELECT i.name FROM sys.indexes i
     JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
     JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
     WHERE i.object_id = OBJECT_ID('Usuarios') AND c.name = 'numero_ambulancia' AND i.is_unique = 1`
  );
  if (idxsNumAmb.length === 0) {
    await sequelize.query(
      `CREATE UNIQUE INDEX [UQ_Usuarios_NumeroAmbulancia] ON [Usuarios]([numero_ambulancia])`
    );
    console.log('[SEED] Índice único UQ_Usuarios_NumeroAmbulancia creado.');
  } else {
    console.log('[SEED] Índice único en numero_ambulancia ya existe.');
  }

  // ── d) Verificar roles ────────────────────────────────────────────────────
  let rolAdmin = await Role.findOne({ where: { nombre: 'admin' } });
  let rolAmb   = await Role.findOne({ where: { nombre: 'ambulancia' } });

  if (!rolAdmin) {
    rolAdmin = await Role.create({ nombre: 'admin', descripcion: 'Administrador del sistema' });
    console.log('[SEED] Rol admin creado.');
  }
  if (!rolAmb) {
    rolAmb = await Role.create({ nombre: 'ambulancia', descripcion: 'Personal de ambulancia' });
    console.log('[SEED] Rol ambulancia creado.');
  }
  console.log(`[SEED] Roles OK — admin id:${rolAdmin.id} | ambulancia id:${rolAmb.id}`);

  // ── e) Crear 22 usuarios ──────────────────────────────────────────────────
  const creados = [];

  // 2 administradores
  const admins = [
    { nombre: 'Administrador 01', numero_ambulancia: 'Administrador01', password_plain: 'Administrador01*' },
    { nombre: 'Administrador 02', numero_ambulancia: 'Administrador02', password_plain: 'Administrador02*' },
  ];
  for (const a of admins) {
    const hash = await bcrypt.hash(a.password_plain, 12);
    const u = await Usuario.create({
      nombre:            a.nombre,
      numero_ambulancia: a.numero_ambulancia,
      password:          hash,
      roleId:            rolAdmin.id,
      activo:            true,
      ambulanciaId:      null,
    });
    creados.push({ id: u.id, numero_ambulancia: u.numero_ambulancia, rol: 'admin' });
    console.log(`[SEED] ✓ ${a.numero_ambulancia} (admin)`);
  }

  // 20 usuarios de ambulancia
  for (let i = 1; i <= 20; i++) {
    const num               = String(i).padStart(2, '0');
    const numero_ambulancia = `Ambulancia${num}`;
    const password_plain    = `${numero_ambulancia}*`;
    const hash              = await bcrypt.hash(password_plain, 12);

    // Buscar ambulanciaId por codigo AMB-XX (null si no existe)
    const ambulancia = await Ambulancia.findOne({ where: { codigo: `AMB-${num}` } });

    const u = await Usuario.create({
      nombre:            `Ambulancia ${num}`,
      numero_ambulancia,
      password:          hash,
      roleId:            rolAmb.id,
      activo:            true,
      ambulanciaId:      ambulancia?.id || null,
    });
    creados.push({ id: u.id, numero_ambulancia: u.numero_ambulancia, ambulanciaId: u.ambulanciaId, rol: 'ambulancia' });
    console.log(`[SEED] ✓ ${numero_ambulancia} (ambulancia, ambulanciaId=${ambulancia?.id ?? 'null'})`);
  }

  // ── f) Verificación final ─────────────────────────────────────────────────
  const [verify] = await sequelize.query(
    `SELECT id, nombre, numero_ambulancia, roleId, activo FROM [Usuarios] ORDER BY roleId, numero_ambulancia`
  );
  console.log('\n[SEED] ══ USUARIOS EN BD ══════════════════════════════════');
  for (const u of verify) {
    console.log(`  id=${u.id} | ${u.numero_ambulancia} | roleId=${u.roleId} | activo=${u.activo}`);
  }
  console.log(`[SEED] ══ TOTAL: ${verify.length} usuarios ══════════════════════════`);

  // Verificar Administrador01 específicamente
  const [admin01] = await sequelize.query(
    `SELECT id, nombre, numero_ambulancia, roleId, LEN(password) as pwd_len FROM [Usuarios]
     WHERE numero_ambulancia = 'Administrador01'`
  );
  if (admin01.length > 0) {
    console.log('\n[SEED] Verificación Administrador01:', JSON.stringify(admin01[0]));
    console.log('[SEED] ✅ Administrador01 existe con password hasheada.');
  } else {
    console.log('[SEED] ❌ Administrador01 NO encontrado.');
  }

  await sequelize.close();
}

seedUsuarios()
  .then(() => {
    console.log('\n[SEED] ✅ Seed completado exitosamente.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[SEED] ❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  });
