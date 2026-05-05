const path = require('path');
const { Insumo, CentroAsistencial, MovimientoInsumo, ReporteInsumo, Usuario } = require('../models');

// GET /api/centros-asistenciales
const getCentros = async (req, res, next) => {
  try {
    const centros = await CentroAsistencial.findAll({
      where: { activo: true },
      order: [
        ['esOtro', 'ASC'],
        ['nombre',  'ASC'],
      ],
    });
    res.json(centros);
  } catch (error) {
    next(error);
  }
};

// POST /api/movimientos/entrega
const crearEntrega = async (req, res, next) => {
  try {
    const {
      codigoInsumo, nombrePaciente, historiaClinica,
      centroAsistencialId, centroOtro, fecha, hora,
      tripulacion, nombreMedico,
    } = req.body;

    if (!codigoInsumo) {
      return res.status(400).json({ message: 'El código del insumo es requerido' });
    }

    // Buscar por código (INS-FAM-###) y como fallback por QR UUID
    let insumo = await Insumo.findOne({ where: { codigo: codigoInsumo.toUpperCase() } });
    if (!insumo) {
      insumo = await Insumo.findOne({ where: { codigo_qr: codigoInsumo } });
    }
    if (!insumo) {
      return res.status(404).json({ message: 'Insumo no encontrado con ese código' });
    }

    // Obtener ambulanciaId del usuario autenticado
    const usuarioDb = await Usuario.findByPk(req.usuario.id, { attributes: ['id', 'ambulanciaId'] });

    const movimiento = await MovimientoInsumo.create({
      tipo:                'entrega',
      insumoId:            insumo.id,
      codigoInsumo:        insumo.codigo || codigoInsumo,
      nombrePaciente:      nombrePaciente   || null,
      historiaClinica:     historiaClinica  || null,
      centroAsistencialId: centroAsistencialId || null,
      centroOtro:          centroOtro       || null,
      fecha,
      hora,
      tripulacion:         tripulacion      || null,
      nombreMedico:        nombreMedico     || null,
      ambulanciaId:        usuarioDb?.ambulanciaId || null,
      usuarioId:           req.usuario.id,
    });

    res.status(201).json({ message: 'Entrega registrada exitosamente', movimiento });
  } catch (error) {
    next(error);
  }
};

// GET /api/movimientos/historial
const getHistorial = async (req, res, next) => {
  try {
    const usuarioDb = await Usuario.findByPk(req.usuario.id, { attributes: ['id', 'ambulanciaId'] });

    if (!usuarioDb?.ambulanciaId) {
      return res.json([]);
    }

    const movimientos = await MovimientoInsumo.findAll({
      where:   { ambulanciaId: usuarioDb.ambulanciaId },
      include: [
        { model: CentroAsistencial, as: 'centroAsistencial', required: false },
        { model: Insumo, as: 'insumo', attributes: ['id', 'nombre', 'codigo'], required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit: 30,
    });

    res.json(movimientos);
  } catch (error) {
    next(error);
  }
};

// GET /api/movimientos/ultimo-por-insumo?codigo=
const ultimoPorInsumo = async (req, res, next) => {
  try {
    const { codigo } = req.query;
    if (!codigo) return res.status(400).json({ message: 'El parámetro codigo es requerido' });

    let insumo = await Insumo.findOne({ where: { codigo: codigo.toUpperCase() } });
    if (!insumo) insumo = await Insumo.findOne({ where: { codigo_qr: codigo } });
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado con ese código' });

    const ultimo = await MovimientoInsumo.findOne({
      where: { insumoId: insumo.id, tipo: 'entrega' },
      include: [{ model: CentroAsistencial, as: 'centroAsistencial', required: false }],
      order: [['createdAt', 'DESC']],
    });

    res.json({ insumo: { id: insumo.id, codigo: insumo.codigo, nombre: insumo.nombre }, ultimaEntrega: ultimo });
  } catch (error) {
    next(error);
  }
};

// POST /api/movimientos/recogida
const crearRecogida = async (req, res, next) => {
  try {
    const {
      codigoInsumo, nombrePaciente, historiaClinica,
      centroAsistencialId, centroOtro, fecha, hora,
      tripulacion, nombreMedico,
    } = req.body;

    if (!codigoInsumo) return res.status(400).json({ message: 'El código del insumo es requerido' });

    let insumo = await Insumo.findOne({ where: { codigo: codigoInsumo.toUpperCase() } });
    if (!insumo) insumo = await Insumo.findOne({ where: { codigo_qr: codigoInsumo } });
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado con ese código' });

    const usuarioDb = await Usuario.findByPk(req.usuario.id, { attributes: ['id', 'ambulanciaId'] });

    const movimiento = await MovimientoInsumo.create({
      tipo:                'recogida',
      insumoId:            insumo.id,
      codigoInsumo:        insumo.codigo || codigoInsumo,
      nombrePaciente:      nombrePaciente   || null,
      historiaClinica:     historiaClinica  || null,
      centroAsistencialId: centroAsistencialId || null,
      centroOtro:          centroOtro       || null,
      fecha,
      hora,
      tripulacion:         tripulacion      || null,
      nombreMedico:        nombreMedico     || null,
      ambulanciaId:        usuarioDb?.ambulanciaId || null,
      usuarioId:           req.usuario.id,
    });

    res.status(201).json({ message: 'Recogida registrada exitosamente', movimiento });
  } catch (error) {
    next(error);
  }
};

// POST /api/movimientos/dano-perdida  (multipart/form-data, campo fotos[] hasta 5)
const crearDanoPerdida = async (req, res, next) => {
  const fotosRutas = (req.files || []).map(
    f => `/uploads/evidencias/${f.filename}`
  );
  try {
    const { tipo, codigoInsumo, motivo, fecha, hora } = req.body;

    if (!['dano', 'perdida'].includes(tipo)) {
      return res.status(400).json({ message: 'tipo debe ser "dano" o "perdida"' });
    }
    if (!codigoInsumo) return res.status(400).json({ message: 'El código del insumo es requerido' });
    if (!motivo?.trim()) return res.status(400).json({ message: 'El motivo es requerido' });

    let insumo = await Insumo.findOne({ where: { codigo: codigoInsumo.toUpperCase() } });
    if (!insumo) insumo = await Insumo.findOne({ where: { codigo_qr: codigoInsumo } });
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado con ese código' });

    const usuarioDb = await Usuario.findByPk(req.usuario.id, { attributes: ['id', 'ambulanciaId'] });

    const reporte = await ReporteInsumo.create({
      tipo,
      insumoId:     insumo.id,
      codigoInsumo: insumo.codigo || codigoInsumo,
      motivo:       motivo.trim(),
      fotosRutas,
      fecha,
      hora,
      ambulanciaId: usuarioDb?.ambulanciaId || null,
      usuarioId:    req.usuario.id,
    });

    res.status(201).json({ message: 'Reporte registrado exitosamente', reporte });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCentros, crearEntrega, getHistorial, ultimoPorInsumo, crearRecogida, crearDanoPerdida };
