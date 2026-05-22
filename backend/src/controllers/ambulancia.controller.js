const { Ambulancia, MovimientoInsumo } = require('../models');
const { Op } = require('sequelize');

const listar = async (req, res, next) => {
  try {
    const { q, activa } = req.query;
    const where = {};

    if (q && q.trim()) {
      where[Op.or] = [
        { codigo:      { [Op.iLike]: `%${q.trim()}%` } },
        { placa:       { [Op.iLike]: `%${q.trim()}%` } },
        { descripcion: { [Op.iLike]: `%${q.trim()}%` } },
      ];
    }

    if (activa === 'true')  where.activa = true;
    else if (activa === 'false') where.activa = false;

    const ambulancias = await Ambulancia.findAll({
      where,
      order: [['codigo', 'ASC']],
    });
    res.json(ambulancias);
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const { codigo, placa, descripcion } = req.body;
    if (!codigo || !placa) {
      return res.status(400).json({ message: 'Código y placa son requeridos' });
    }

    const codigoTrim = codigo.trim();
    const placaTrim  = placa.trim().toUpperCase();

    const existeCodigo = await Ambulancia.findOne({ where: { codigo: codigoTrim } });
    if (existeCodigo) return res.status(409).json({ message: 'Ya existe una ambulancia con ese código' });

    const existePlaca = await Ambulancia.findOne({ where: { placa: placaTrim } });
    if (existePlaca) return res.status(409).json({ message: 'Ya existe una ambulancia con esa placa' });

    const nueva = await Ambulancia.create({
      codigo:      codigoTrim,
      placa:       placaTrim,
      descripcion: descripcion ? descripcion.trim() : null,
      activa:      true,
    });
    res.status(201).json(nueva);
  } catch (error) {
    next(error);
  }
};

const editar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { codigo, placa, descripcion } = req.body;

    const ambulancia = await Ambulancia.findByPk(id);
    if (!ambulancia) return res.status(404).json({ message: 'Ambulancia no encontrada' });

    if (codigo !== undefined) {
      const codigoTrim = codigo.trim();
      if (codigoTrim !== ambulancia.codigo) {
        const existe = await Ambulancia.findOne({ where: { codigo: codigoTrim } });
        if (existe) return res.status(409).json({ message: 'Ya existe una ambulancia con ese código' });
        ambulancia.codigo = codigoTrim;
      }
    }

    if (placa !== undefined) {
      const placaTrim = placa.trim().toUpperCase();
      if (placaTrim !== ambulancia.placa) {
        const existe = await Ambulancia.findOne({ where: { placa: placaTrim } });
        if (existe) return res.status(409).json({ message: 'Ya existe una ambulancia con esa placa' });
        ambulancia.placa = placaTrim;
      }
    }

    if (descripcion !== undefined) {
      ambulancia.descripcion = descripcion ? descripcion.trim() : null;
    }

    await ambulancia.save();
    res.json(ambulancia);
  } catch (error) {
    next(error);
  }
};

const toggleActiva = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ambulancia = await Ambulancia.findByPk(id);
    if (!ambulancia) return res.status(404).json({ message: 'Ambulancia no encontrada' });

    ambulancia.activa = !ambulancia.activa;
    await ambulancia.save();
    res.json(ambulancia);
  } catch (error) {
    next(error);
  }
};

const eliminar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ambulancia = await Ambulancia.findByPk(id);
    if (!ambulancia) return res.status(404).json({ message: 'Ambulancia no encontrada' });

    const movimientos = await MovimientoInsumo.count({ where: { ambulanciaId: id } });
    if (movimientos > 0) {
      return res.status(409).json({
        message: `No se puede eliminar: la ambulancia tiene ${movimientos} movimiento(s) registrado(s)`,
      });
    }

    await ambulancia.destroy();
    res.json({ message: 'Ambulancia eliminada correctamente' });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, crear, editar, toggleActiva, eliminar };
