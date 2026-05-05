const { Op } = require('sequelize');
const {
  Insumo, BajaInsumo, ReasignacionAmbulancia,
  MovimientoInventario, Ambulancia, sequelize,
} = require('../models');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const toPublicPath = (filename) => `/uploads/insumos/${filename}`;

const deleteFile = (relativePath) => {
  if (!relativePath) return;
  const abs = path.join(__dirname, '../..', relativePath);
  fs.unlink(abs, () => {});
};

// Formatea fecha a DD-MM-AAAA
const formatFecha = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}-${mes}-${d.getFullYear()}`;
};

const formatInsumo = (insumo) => {
  const obj = insumo.toJSON ? insumo.toJSON() : { ...insumo };
  return {
    ...obj,
    fecha_creacion: formatFecha(obj.createdAt),
    fecha_modificacion: formatFecha(obj.updatedAt),
  };
};

// Incremento atómico del contador global (UPDLOCK evita condiciones de carrera)
async function siguienteContador(t) {
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

const generarCodigo = async (familia_abrev, transaction) => {
  const num = await siguienteContador(transaction);
  return `INS-${familia_abrev.toUpperCase().slice(0, 5)}-${String(num).padStart(3, '0')}`;
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/insumos  — lista insumos activos con ambulancia asociada
// ──────────────────────────────────────────────────────────────────────────────
const listar = async (req, res, next) => {
  try {
    const { ambulanciaId, familia } = req.query;
    const where = { estado: 'activo' };
    if (ambulanciaId) where.ambulanciaId = ambulanciaId;
    if (familia) where.familia = familia;

    const insumos = await Insumo.findAll({
      where,
      include: [{ model: Ambulancia, as: 'ambulancia', attributes: ['id', 'codigo', 'descripcion'] }],
      order: [['codigo', 'ASC']],
    });

    res.json(insumos.map(formatInsumo));
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/insumos/bajas  — historial de insumos dados de baja
// ──────────────────────────────────────────────────────────────────────────────
const listarBajas = async (req, res, next) => {
  try {
    const bajas = await BajaInsumo.findAll({ order: [['fecha_baja', 'DESC']] });
    res.json(bajas.map(b => ({
      ...b.toJSON(),
      fecha_baja_fmt: formatFecha(b.fecha_baja),
    })));
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/insumos/:id
// ──────────────────────────────────────────────────────────────────────────────
const obtener = async (req, res, next) => {
  try {
    const insumo = await Insumo.findByPk(req.params.id, {
      include: [{ model: Ambulancia, as: 'ambulancia', attributes: ['id', 'codigo', 'descripcion'] }],
    });
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });
    res.json(formatInsumo(insumo));
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/insumos/buscar  — ?q= busca por nombre/código (ILIKE), ?codigo= exacto
// ──────────────────────────────────────────────────────────────────────────────
const buscar = async (req, res, next) => {
  try {
    const { q, codigo } = req.query;

    if (codigo) {
      const insumo = await Insumo.findOne({
        where: { codigo: codigo.toUpperCase() },
        include: [{ model: Ambulancia, as: 'ambulancia', attributes: ['id', 'codigo', 'descripcion'] }],
      });
      if (!insumo) return res.status(404).json({ message: 'No se encontró ningún insumo con ese código' });
      return res.json(formatInsumo(insumo));
    }

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const term = `%${q.trim()}%`;

    // unaccent permite buscar sin importar tildes (ej. "pediatrico" → "Pediátrico")
    const rows = await sequelize.query(`
      SELECT i.id, i.codigo, i.nombre, i.familia, i.especificaciones,
             i."ambulanciaId", i.estado, a.codigo AS "ambulanciaCodigo"
      FROM "Insumos" i
      LEFT JOIN "Ambulancias" a ON a.id = i."ambulanciaId"
      WHERE i.estado = 'activo'
        AND (
          unaccent(i.nombre)              ILIKE unaccent(:term)
          OR unaccent(COALESCE(i.codigo,''))           ILIKE unaccent(:term)
          OR unaccent(COALESCE(i.familia,''))          ILIKE unaccent(:term)
          OR unaccent(COALESCE(i.especificaciones,'')) ILIKE unaccent(:term)
        )
      ORDER BY i.codigo ASC
      LIMIT 8
    `, { replacements: { term }, type: 'SELECT' });

    const insumos = rows.map(r => ({
      id:              r.id,
      codigo:          r.codigo,
      nombre:          r.nombre,
      familia:         r.familia,
      especificaciones: r.especificaciones,
      ambulanciaId:    r.ambulanciaId,
      estado:          r.estado,
      ambulancia:      r.ambulanciaCodigo ? { codigo: r.ambulanciaCodigo } : null,
    }));

    res.json(insumos);
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/insumos/qr/:codigo  — escaneo QR: acepta código INS o UUID legacy
// ──────────────────────────────────────────────────────────────────────────────
const buscarPorQR = async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const include = [{ model: Ambulancia, as: 'ambulancia', attributes: ['id', 'codigo', 'descripcion'] }];

    // Primero intenta con el nuevo código INS-FAM-###
    let insumo = await Insumo.findOne({ where: { codigo: codigo.toUpperCase() }, include });
    // Si no lo encuentra, intenta con el UUID legacy
    if (!insumo) {
      insumo = await Insumo.findOne({ where: { codigo_qr: codigo }, include });
    }

    if (!insumo) return res.status(404).json({ message: 'No se encontró ningún insumo con ese código QR' });
    res.json(formatInsumo(insumo));
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/insumos  — crea N registros independientes (uno por unidad física)
// ──────────────────────────────────────────────────────────────────────────────
const crear = async (req, res, next) => {
  try {
    const { nombre, familia, familia_abrev, especificaciones, ambulanciaId, cantidad = 1 } = req.body;

    if (!nombre?.trim()) return res.status(400).json({ message: 'El nombre del insumo es requerido' });
    if (!familia?.trim()) return res.status(400).json({ message: 'La familia del insumo es requerida' });
    if (!familia_abrev?.trim())
      return res.status(400).json({ message: 'La abreviatura de la familia es requerida' });

    const cantidadNum = parseInt(cantidad, 10);
    if (isNaN(cantidadNum) || cantidadNum < 1 || cantidadNum > 50)
      return res.status(400).json({ message: 'La cantidad debe ser un número entre 1 y 50' });

    const creados = [];
    const t = await sequelize.transaction();

    try {
      for (let i = 0; i < cantidadNum; i++) {
        const codigo = await generarCodigo(familia_abrev.trim(), t);
        const insumo = await Insumo.create({
          codigo,
          nombre: nombre.trim(),
          familia: familia.trim(),
          familia_abrev: familia_abrev.toUpperCase().trim().slice(0, 5),
          especificaciones: especificaciones?.trim() || null,
          estado: 'activo',
          ambulanciaId: ambulanciaId ? parseInt(ambulanciaId, 10) : null,
          cantidad_disponible: 1,
          codigo_qr: codigo, // el QR encoda el código INS para compatibilidad
        }, { transaction: t });
        creados.push(formatInsumo(insumo));
      }
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    res.status(201).json({ creados, total: creados.length });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/insumos/:id  — edita campos modificables del insumo
// ──────────────────────────────────────────────────────────────────────────────
const editar = async (req, res, next) => {
  try {
    const { nombre, especificaciones, ambulanciaId, observaciones } = req.body;

    const insumo = await Insumo.findByPk(req.params.id);
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });
    if (insumo.estado === 'dado_de_baja')
      return res.status(400).json({ message: 'No se puede editar un insumo dado de baja' });

    if (nombre !== undefined) {
      if (!nombre.trim()) return res.status(400).json({ message: 'El nombre no puede estar vacío' });
      insumo.nombre = nombre.trim();
    }
    if (especificaciones !== undefined) insumo.especificaciones = especificaciones?.trim() || null;
    if (ambulanciaId !== undefined) {
      insumo.ambulanciaId = ambulanciaId ? parseInt(ambulanciaId, 10) : null;
    }
    if (observaciones !== undefined) insumo.observaciones = observaciones?.trim() || null;

    await insumo.save();

    const actualizado = await Insumo.findByPk(insumo.id, {
      include: [{ model: Ambulancia, as: 'ambulancia', attributes: ['id', 'codigo', 'descripcion'] }],
    });
    res.json(formatInsumo(actualizado));
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/insumos/:id/baja  — da de baja con motivo obligatorio + foto
// ──────────────────────────────────────────────────────────────────────────────
const darDeBaja = async (req, res, next) => {
  try {
    const { motivo } = req.body;

    if (!motivo?.trim()) {
      if (req.file) deleteFile(toPublicPath(req.file.filename));
      return res.status(400).json({ message: 'El motivo de baja es requerido' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'La foto de evidencia es requerida para dar de baja' });
    }

    const insumo = await Insumo.findByPk(req.params.id, {
      include: [{ model: Ambulancia, as: 'ambulancia', attributes: ['id', 'codigo'] }],
    });

    if (!insumo) {
      deleteFile(toPublicPath(req.file.filename));
      return res.status(404).json({ message: 'Insumo no encontrado' });
    }
    if (insumo.estado === 'dado_de_baja') {
      deleteFile(toPublicPath(req.file.filename));
      return res.status(400).json({ message: 'El insumo ya está dado de baja' });
    }

    const foto_ruta = toPublicPath(req.file.filename);

    const baja = await BajaInsumo.create({
      insumoId: insumo.id,
      codigo: insumo.codigo || `ID-${insumo.id}`,
      nombre: insumo.nombre,
      familia: insumo.familia || '—',
      especificaciones: insumo.especificaciones || null,
      ambulancia_codigo: insumo.ambulancia?.codigo || null,
      motivo: motivo.trim(),
      foto_ruta,
    });

    insumo.estado = 'dado_de_baja';
    insumo.ambulanciaId = null;
    await insumo.save();

    res.json({
      message: 'Insumo dado de baja correctamente',
      baja: { ...baja.toJSON(), fecha_baja_fmt: formatFecha(baja.fecha_baja) },
    });
  } catch (error) {
    if (req.file) deleteFile(toPublicPath(req.file.filename));
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/insumos/:id/reasignar  — reasigna o presta a otra ambulancia
// ──────────────────────────────────────────────────────────────────────────────
const reasignar = async (req, res, next) => {
  try {
    const { ambulancia_nueva_id, tipo = 'permanente', notas, fecha_devolucion_esperada } = req.body;

    const insumo = await Insumo.findByPk(req.params.id, {
      include: [{ model: Ambulancia, as: 'ambulancia', attributes: ['id', 'codigo'] }],
    });
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });
    if (insumo.estado === 'dado_de_baja')
      return res.status(400).json({ message: 'No se puede reasignar un insumo dado de baja' });
    if (!['permanente', 'prestamo'].includes(tipo))
      return res.status(400).json({ message: 'Tipo debe ser "permanente" o "prestamo"' });

    let ambulanciaNueva = null;
    if (ambulancia_nueva_id) {
      ambulanciaNueva = await Ambulancia.findByPk(ambulancia_nueva_id);
      if (!ambulanciaNueva)
        return res.status(404).json({ message: 'Ambulancia de destino no encontrada' });
    }

    const reasignacion = await ReasignacionAmbulancia.create({
      insumoId: insumo.id,
      codigo_insumo: insumo.codigo || `ID-${insumo.id}`,
      ambulancia_anterior_id: insumo.ambulanciaId || null,
      ambulancia_anterior_codigo: insumo.ambulancia?.codigo || null,
      ambulancia_nueva_id: ambulancia_nueva_id ? parseInt(ambulancia_nueva_id, 10) : null,
      ambulancia_nueva_codigo: ambulanciaNueva?.codigo || null,
      tipo,
      notas: notas?.trim() || null,
      fecha_devolucion_esperada: fecha_devolucion_esperada || null,
      usuario_responsable: req.usuario?.numero_ambulancia || String(req.usuario?.id || ''),
    });

    insumo.ambulanciaId = ambulancia_nueva_id ? parseInt(ambulancia_nueva_id, 10) : null;
    await insumo.save();

    res.json({
      message: 'Insumo reasignado correctamente',
      reasignacion: {
        ...reasignacion.toJSON(),
        fecha_reasignacion_fmt: formatFecha(reasignacion.fecha_reasignacion),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/insumos/:id/qr  — imagen PNG del QR (encoda el código INS)
// ──────────────────────────────────────────────────────────────────────────────
const generarQR = async (req, res, next) => {
  try {
    const insumo = await Insumo.findByPk(req.params.id, {
      include: [{ model: Ambulancia, as: 'ambulancia', attributes: ['id', 'codigo'] }],
    });
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });

    const valorQR = insumo.codigo || insumo.codigo_qr;
    if (!valorQR) return res.status(400).json({ message: 'Este insumo no tiene código asignado' });

    const pngBuffer = await QRCode.toBuffer(valorQR, {
      type: 'png',
      width: 300,
      margin: 2,
      color: { dark: '#1a2e25', light: '#ffffff' },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="qr-${(insumo.codigo || insumo.id)}.png"`
    );
    res.send(pngBuffer);
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/insumos/:id/reasignaciones  — historial de reasignaciones del insumo
// ──────────────────────────────────────────────────────────────────────────────
const historialReasignaciones = async (req, res, next) => {
  try {
    const insumo = await Insumo.findByPk(req.params.id);
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });

    const reasignaciones = await ReasignacionAmbulancia.findAll({
      where: { insumoId: req.params.id },
      order: [['fecha_reasignacion', 'DESC']],
    });

    res.json(reasignaciones.map(r => ({
      ...r.toJSON(),
      fecha_reasignacion_fmt: formatFecha(r.fecha_reasignacion),
      fecha_devolucion_fmt: formatFecha(r.fecha_devolucion_esperada),
    })));
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Endpoints legacy mantenidos por compatibilidad con datos existentes
// ──────────────────────────────────────────────────────────────────────────────

// DELETE /api/insumos/:id — baja sin foto (compatibilidad con frontend anterior)
const eliminarLogico = async (req, res, next) => {
  try {
    const { motivo } = req.body;
    const insumo = await Insumo.findByPk(req.params.id);
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });

    const baja = await BajaInsumo.create({
      insumoId: insumo.id,
      codigo: insumo.codigo || `ID-${insumo.id}`,
      nombre: insumo.nombre,
      familia: insumo.familia || '—',
      especificaciones: insumo.especificaciones || null,
      ambulancia_codigo: null,
      motivo: motivo?.trim() || 'Dado de baja del inventario',
      foto_ruta: null,
    });

    insumo.estado = 'dado_de_baja';
    insumo.ambulanciaId = null;
    await insumo.save();

    res.json({ message: 'Insumo dado de baja correctamente', id: insumo.id });
  } catch (error) {
    next(error);
  }
};

// PUT /api/insumos/:id/estado
const cambiarEstado = async (req, res, next) => {
  try {
    const { estado, motivo } = req.body;
    if (!['activo', 'dado_de_baja'].includes(estado))
      return res.status(400).json({ message: 'Estado inválido. Válidos: activo, dado_de_baja' });

    const insumo = await Insumo.findByPk(req.params.id);
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });

    insumo.estado = estado;
    if (motivo) insumo.observaciones = motivo.trim();
    await insumo.save();
    res.json(formatInsumo(insumo));
  } catch (error) {
    next(error);
  }
};

// GET /api/insumos/:id/historial — movimientos legacy
const historial = async (req, res, next) => {
  try {
    const insumo = await Insumo.findByPk(req.params.id);
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });

    const movimientos = await MovimientoInventario.findAll({
      where: { id_insumo: req.params.id },
      order: [['fecha', 'DESC']],
    });

    res.json({ insumo: formatInsumo(insumo), movimientos });
  } catch (error) {
    next(error);
  }
};

// POST /api/insumos/:id/movimiento — legacy
const registrarMovimiento = async (req, res, next) => {
  res.status(410).json({
    message: 'Este endpoint fue reemplazado. Use POST /api/insumos/:id/baja o POST /api/insumos/:id/reasignar',
  });
};

module.exports = {
  listar,
  listarBajas,
  obtener,
  buscar,
  buscarPorQR,
  crear,
  editar,
  darDeBaja,
  reasignar,
  generarQR,
  historialReasignaciones,
  eliminarLogico,
  cambiarEstado,
  historial,
  registrarMovimiento,
};
