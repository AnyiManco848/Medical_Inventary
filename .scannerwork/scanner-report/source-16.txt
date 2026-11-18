const { CentroAsistencial, MovimientoInsumo } = require('../models');
const { Op } = require('sequelize');

const listar = async (req, res, next) => {
  try {
    const { q } = req.query;
    const where = {};
    if (q && q.trim()) {
      where[Op.or] = [
        { nombre:    { [Op.iLike]: `%${q.trim()}%` } },
        { municipio: { [Op.iLike]: `%${q.trim()}%` } },
      ];
    }
    const centros = await CentroAsistencial.findAll({
      where,
      order: [['nombre', 'ASC']],
    });
    res.json(centros);
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const { nombre, municipio, direccion, telefono, correo } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }

    const existe = await CentroAsistencial.findOne({ where: { nombre: nombre.trim() } });
    if (existe) return res.status(409).json({ message: 'Ya existe un centro con ese nombre.' });

    const centro = await CentroAsistencial.create({
      nombre:        nombre.trim(),
      municipio:     municipio?.trim() || 'Valle de Aburrá',
      direccion:     direccion?.trim() || null,
      telefono:      telefono?.trim()  || null,
      correo:        correo?.trim()    || null,
      fechaRegistro: new Date().toISOString().split('T')[0],
      activo:        true,
      esOtro:        false,
    });
    res.status(201).json(centro);
  } catch (error) {
    next(error);
  }
};

const editar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const centro = await CentroAsistencial.findByPk(id);
    if (!centro) return res.status(404).json({ message: 'Centro no encontrado.' });

    const { nombre, municipio, direccion, telefono, correo } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }

    const existe = await CentroAsistencial.findOne({
      where: { nombre: nombre.trim(), id: { [Op.ne]: parseInt(id, 10) } },
    });
    if (existe) return res.status(409).json({ message: 'Ya existe un centro con ese nombre.' });

    await centro.update({
      nombre:    nombre.trim(),
      municipio: municipio?.trim() || centro.municipio,
      direccion: direccion?.trim() || null,
      telefono:  telefono?.trim()  || null,
      correo:    correo?.trim()    || null,
    });
    res.json(centro);
  } catch (error) {
    next(error);
  }
};

const toggleActivo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const centro = await CentroAsistencial.findByPk(id);
    if (!centro) return res.status(404).json({ message: 'Centro no encontrado.' });
    await centro.update({ activo: !centro.activo });
    res.json(centro);
  } catch (error) {
    next(error);
  }
};

const eliminar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const centro = await CentroAsistencial.findByPk(id);
    if (!centro) return res.status(404).json({ message: 'Centro no encontrado.' });

    const n = await MovimientoInsumo.count({ where: { centroAsistencialId: parseInt(id, 10) } });
    if (n > 0) {
      return res.status(409).json({
        message: `No se puede eliminar: tiene ${n} movimiento${n !== 1 ? 's' : ''} registrado${n !== 1 ? 's' : ''}.`,
      });
    }

    await centro.destroy();
    res.json({ message: 'Centro eliminado.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, crear, editar, toggleActivo, eliminar };
