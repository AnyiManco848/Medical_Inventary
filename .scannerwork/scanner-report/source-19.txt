const { sequelize } = require('../models');

// GET /api/reportes/mis-entregas  — solo rol ambulancia
// Devuelve las entregas del usuario autenticado con el estado actual de cada insumo
const getMisEntregas = async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;

    const rows = await sequelize.query(`
      SELECT
        e.id,
        e."codigoInsumo",
        e.fecha,
        e.hora,
        e."nombreMedico",
        e."centroOtro",
        i.nombre  AS "insumoNombre",
        ca.nombre AS "centroNombre",
        CASE
          WHEN e."insumoId" IS NULL THEN 'En centro asistencial'
          WHEN EXISTS (
            SELECT 1 FROM "MovimientosInsumo" r
            WHERE r."insumoId" = e."insumoId"
              AND r.tipo = 'recogida'
              AND r."createdAt" > e."createdAt"
          ) THEN 'Recuperado'
          ELSE 'En centro asistencial'
        END AS "estadoActual"
      FROM "MovimientosInsumo" e
      LEFT JOIN "Insumos"            i  ON i.id  = e."insumoId"
      LEFT JOIN "CentrosAsistenciales" ca ON ca.id = e."centroAsistencialId"
      WHERE e.tipo = 'entrega'
        AND e."usuarioId" = :usuarioId
      ORDER BY e."createdAt" DESC
      LIMIT 100
    `, { replacements: { usuarioId }, type: 'SELECT' });

    res.json(rows);
  } catch (error) {
    next(error);
  }
};

// GET /api/reportes/admin/historial  — solo rol admin
// Historial completo de entregas con filtros opcionales
const getAdminHistorial = async (req, res, next) => {
  try {
    const { ambulanciaId, centroId, fechaDesde, fechaHasta, insumo } = req.query;

    const conditions = [`e.tipo = 'entrega'`];
    const replacements = {};

    if (ambulanciaId && !isNaN(parseInt(ambulanciaId, 10))) {
      conditions.push(`e."ambulanciaId" = :ambulanciaId`);
      replacements.ambulanciaId = parseInt(ambulanciaId, 10);
    }
    if (centroId && !isNaN(parseInt(centroId, 10))) {
      conditions.push(`e."centroAsistencialId" = :centroId`);
      replacements.centroId = parseInt(centroId, 10);
    }
    if (fechaDesde) {
      conditions.push(`e.fecha >= :fechaDesde`);
      replacements.fechaDesde = fechaDesde;
    }
    if (fechaHasta) {
      conditions.push(`e.fecha <= :fechaHasta`);
      replacements.fechaHasta = fechaHasta;
    }
    if (insumo && insumo.trim().length >= 1) {
      conditions.push(`(unaccent(COALESCE(i.nombre,'')) ILIKE unaccent(:insumo) OR unaccent(COALESCE(e."codigoInsumo",'')) ILIKE unaccent(:insumo))`);
      replacements.insumo = `%${insumo.trim()}%`;
    }

    const whereClause = conditions.join(' AND ');

    const rows = await sequelize.query(`
      SELECT
        e.id,
        e."codigoInsumo",
        e.fecha,
        e.hora,
        e."nombreMedico",
        e."centroOtro",
        i.nombre   AS "insumoNombre",
        ca.nombre  AS "centroNombre",
        amb.codigo AS "ambulanciaCodigo",
        ue.nombre  AS "usuarioEntrega",
        ur.nombre  AS "usuarioRecogida",
        CASE
          WHEN e."insumoId" IS NULL THEN 'En centro asistencial'
          WHEN rec.id IS NOT NULL    THEN 'Recuperado'
          ELSE 'En centro asistencial'
        END AS "estadoActual"
      FROM "MovimientosInsumo" e
      LEFT JOIN "Insumos"             i   ON i.id   = e."insumoId"
      LEFT JOIN "CentrosAsistenciales" ca  ON ca.id  = e."centroAsistencialId"
      LEFT JOIN "Ambulancias"          amb ON amb.id = e."ambulanciaId"
      LEFT JOIN "Usuarios"             ue  ON ue.id  = e."usuarioId"
      LEFT JOIN LATERAL (
        SELECT r2.id, r2."usuarioId"
        FROM "MovimientosInsumo" r2
        WHERE r2."insumoId" = e."insumoId"
          AND r2.tipo = 'recogida'
          AND r2."createdAt" > e."createdAt"
        ORDER BY r2."createdAt" ASC
        LIMIT 1
      ) rec ON true
      LEFT JOIN "Usuarios" ur ON ur.id = rec."usuarioId"
      WHERE ${whereClause}
      ORDER BY e."createdAt" DESC
      LIMIT 200
    `, { replacements, type: 'SELECT' });

    res.json(rows);
  } catch (error) {
    next(error);
  }
};

// GET /api/reportes/admin/pendientes  — solo rol admin
// Entregas sin recogida correspondiente (insumos aún en centro asistencial)
// Soporta filtros opcionales: ?fechaDesde=YYYY-MM-DD&fechaHasta=YYYY-MM-DD
const getAdminPendientes = async (req, res, next) => {
  try {
    const { fechaDesde, fechaHasta } = req.query;

    const extraConditions = [];
    const replacements = {};

    if (fechaDesde) {
      extraConditions.push(`e.fecha >= :fechaDesde`);
      replacements.fechaDesde = fechaDesde;
    }
    if (fechaHasta) {
      extraConditions.push(`e.fecha <= :fechaHasta`);
      replacements.fechaHasta = fechaHasta;
    }

    const whereClause = [
      `e.tipo = 'entrega'`,
      `(e."insumoId" IS NULL OR NOT EXISTS (SELECT 1 FROM "MovimientosInsumo" r WHERE r."insumoId" = e."insumoId" AND r.tipo = 'recogida' AND r."createdAt" > e."createdAt"))`,
      ...extraConditions,
    ].join(' AND ');

    const rows = await sequelize.query(`
      SELECT
        e.id,
        e."codigoInsumo",
        e.fecha,
        e.hora,
        e."centroOtro",
        i.nombre   AS "insumoNombre",
        ca.nombre  AS "centroNombre",
        amb.codigo AS "ambulanciaCodigo",
        u.nombre   AS "usuarioNombre"
      FROM "MovimientosInsumo" e
      LEFT JOIN "Insumos"             i   ON i.id   = e."insumoId"
      LEFT JOIN "CentrosAsistenciales" ca  ON ca.id  = e."centroAsistencialId"
      LEFT JOIN "Ambulancias"          amb ON amb.id = e."ambulanciaId"
      LEFT JOIN "Usuarios"             u   ON u.id   = e."usuarioId"
      WHERE ${whereClause}
      ORDER BY e.fecha ASC, e.hora ASC
    `, { replacements, type: 'SELECT' });

    res.json(rows);
  } catch (error) {
    next(error);
  }
};

module.exports = { getMisEntregas, getAdminHistorial, getAdminPendientes };
