// Controlador de inventario: CRUD de insumos + movimientos + QR
const { Insumo, MovimientoInventario } = require('../models');
const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Ruta relativa al directorio de uploads (nunca se expone la ruta absoluta)
const toPublicPath = (filename) => `/uploads/insumos/${filename}`;

// Elimina archivo del sistema de archivos si existe
const deleteFile = (relativePath) => {
  if (!relativePath) return;
  const abs = path.join(__dirname, '../..', relativePath);
  fs.unlink(abs, () => {});
};

// GET /api/insumos
const listar = async (req, res, next) => {
  try {
    const insumos = await Insumo.findAll({ order: [['nombre', 'ASC']] });
    res.json(insumos);
  } catch (error) {
    next(error);
  }
};

// GET /api/insumos/:id
const obtener = async (req, res, next) => {
  try {
    const insumo = await Insumo.findByPk(req.params.id);
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });
    res.json(insumo);
  } catch (error) {
    next(error);
  }
};

// POST /api/insumos  (multipart/form-data — imagen opcional)
const crear = async (req, res, next) => {
  try {
    const { nombre, cantidad_disponible = 0, observaciones } = req.body;

    if (!nombre || !nombre.trim()) {
      if (req.file) deleteFile(toPublicPath(req.file.filename));
      return res.status(400).json({ message: 'El nombre del insumo es requerido' });
    }

    const cantidadNum = parseInt(cantidad_disponible, 10);
    if (isNaN(cantidadNum) || cantidadNum < 0) {
      if (req.file) deleteFile(toPublicPath(req.file.filename));
      return res.status(400).json({ message: 'La cantidad debe ser un entero no negativo' });
    }

    // UUID como código QR único (Node 18+ crypto.randomUUID es estable)
    const codigo_qr = crypto.randomUUID();
    const imagen_ruta = req.file ? toPublicPath(req.file.filename) : null;

    const insumo = await Insumo.create({
      nombre: nombre.trim(),
      cantidad_disponible: cantidadNum,
      estado: 'activo',
      codigo_qr,
      imagen_ruta,
      observaciones: observaciones ? observaciones.trim() : null,
    });

    // Registrar entrada inicial si hay stock
    if (cantidadNum > 0) {
      await MovimientoInventario.create({
        id_insumo: insumo.id,
        tipo: 'entrada',
        cantidad: cantidadNum,
        usuario: req.usuario.cedula || String(req.usuario.id),
        motivo: 'Stock inicial al crear insumo',
      });
    }

    res.status(201).json(insumo);
  } catch (error) {
    if (req.file) deleteFile(toPublicPath(req.file.filename));
    next(error);
  }
};

// PUT /api/insumos/:id  (multipart/form-data — imagen opcional)
const editar = async (req, res, next) => {
  try {
    const { nombre, cantidad_disponible, observaciones } = req.body;

    const insumo = await Insumo.findByPk(req.params.id);
    if (!insumo) {
      if (req.file) deleteFile(toPublicPath(req.file.filename));
      return res.status(404).json({ message: 'Insumo no encontrado' });
    }

    if (nombre !== undefined) {
      if (!nombre.trim()) {
        if (req.file) deleteFile(toPublicPath(req.file.filename));
        return res.status(400).json({ message: 'El nombre no puede estar vacío' });
      }
      insumo.nombre = nombre.trim();
    }

    if (cantidad_disponible !== undefined) {
      const cantidadNum = parseInt(cantidad_disponible, 10);
      if (isNaN(cantidadNum) || cantidadNum < 0) {
        if (req.file) deleteFile(toPublicPath(req.file.filename));
        return res.status(400).json({ message: 'La cantidad debe ser un entero no negativo' });
      }
      insumo.cantidad_disponible = cantidadNum;
    }

    if (observaciones !== undefined) {
      insumo.observaciones = observaciones ? observaciones.trim() : null;
    }

    if (req.file) {
      deleteFile(insumo.imagen_ruta); // eliminar imagen anterior
      insumo.imagen_ruta = toPublicPath(req.file.filename);
    }

    await insumo.save();
    res.json(insumo);
  } catch (error) {
    if (req.file) deleteFile(toPublicPath(req.file.filename));
    next(error);
  }
};

// DELETE /api/insumos/:id — soft delete: marca como dado_de_baja
const eliminarLogico = async (req, res, next) => {
  try {
    const { motivo } = req.body;

    const insumo = await Insumo.findByPk(req.params.id);
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });

    if (insumo.cantidad_disponible > 0) {
      await MovimientoInventario.create({
        id_insumo: insumo.id,
        tipo: 'salida',
        cantidad: insumo.cantidad_disponible,
        usuario: req.usuario.cedula || String(req.usuario.id),
        motivo: motivo || 'Dado de baja del inventario',
      });
    }

    insumo.estado = 'dado_de_baja';
    insumo.cantidad_disponible = 0;
    if (motivo) insumo.observaciones = motivo;
    await insumo.save();

    res.json({ message: 'Insumo dado de baja correctamente', id: insumo.id });
  } catch (error) {
    next(error);
  }
};

// GET /api/insumos/qr/:codigo — buscar insumo por su código QR (UUID)
const buscarPorQR = async (req, res, next) => {
  try {
    const insumo = await Insumo.findOne({ where: { codigo_qr: req.params.codigo } });
    if (!insumo) return res.status(404).json({ message: 'No se encontró ningún insumo con ese código QR' });
    res.json(insumo);
  } catch (error) {
    next(error);
  }
};

// GET /api/insumos/:id/qr — devuelve imagen PNG del código QR del insumo
const generarQR = async (req, res, next) => {
  try {
    const insumo = await Insumo.findByPk(req.params.id);
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });

    if (!insumo.codigo_qr) {
      return res.status(400).json({ message: 'Este insumo no tiene código QR asignado' });
    }

    const pngBuffer = await QRCode.toBuffer(insumo.codigo_qr, {
      type: 'png',
      width: 300,
      margin: 2,
      color: { dark: '#1a2e25', light: '#ffffff' },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="qr-${insumo.nombre.replace(/[^a-zA-Z0-9]/g, '_')}.png"`
    );
    res.send(pngBuffer);
  } catch (error) {
    next(error);
  }
};

// POST /api/insumos/:id/movimiento — registrar entrada o salida
const registrarMovimiento = async (req, res, next) => {
  try {
    const { tipo, cantidad, numero_ambulancia, motivo } = req.body;

    if (!tipo || !['entrada', 'salida'].includes(tipo)) {
      return res.status(400).json({ message: 'El tipo debe ser "entrada" o "salida"' });
    }

    const cantidadNum = parseInt(cantidad, 10);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      return res.status(400).json({ message: 'La cantidad debe ser un entero mayor a 0' });
    }

    const insumo = await Insumo.findByPk(req.params.id);
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });

    if (insumo.estado === 'dado_de_baja') {
      return res.status(400).json({ message: 'No se pueden registrar movimientos en un insumo dado de baja' });
    }

    if (tipo === 'salida' && insumo.cantidad_disponible < cantidadNum) {
      return res.status(400).json({
        message: `Stock insuficiente. Disponible: ${insumo.cantidad_disponible}, solicitado: ${cantidadNum}`,
      });
    }

    insumo.cantidad_disponible += tipo === 'entrada' ? cantidadNum : -cantidadNum;
    await insumo.save();

    const movimiento = await MovimientoInventario.create({
      id_insumo: insumo.id,
      tipo,
      cantidad: cantidadNum,
      usuario: req.usuario.cedula || String(req.usuario.id),
      numero_ambulancia: numero_ambulancia ? numero_ambulancia.trim() : null,
      motivo: motivo ? motivo.trim() : null,
    });

    res.status(201).json({ movimiento, cantidad_disponible: insumo.cantidad_disponible });
  } catch (error) {
    next(error);
  }
};

// PUT /api/insumos/:id/estado — cambiar estado (en_mal_estado, dado_de_baja, prestado, activo)
const cambiarEstado = async (req, res, next) => {
  try {
    const { estado, cantidad, motivo } = req.body;
    const estadosValidos = ['activo', 'en_mal_estado', 'dado_de_baja', 'prestado'];

    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({ message: `Estado inválido. Válidos: ${estadosValidos.join(', ')}` });
    }

    const insumo = await Insumo.findByPk(req.params.id);
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });

    const cantidadAfectada = cantidad ? parseInt(cantidad, 10) : 0;

    // Si se indica cantidad afectada para estados de degradación, reducir stock y registrar salida
    if (['en_mal_estado', 'dado_de_baja'].includes(estado) && cantidadAfectada > 0) {
      if (insumo.cantidad_disponible < cantidadAfectada) {
        return res.status(400).json({
          message: `Stock insuficiente. Disponible: ${insumo.cantidad_disponible}`,
        });
      }
      insumo.cantidad_disponible -= cantidadAfectada;
      await MovimientoInventario.create({
        id_insumo: insumo.id,
        tipo: 'salida',
        cantidad: cantidadAfectada,
        usuario: req.usuario.cedula || String(req.usuario.id),
        motivo: motivo || `Insumo marcado como ${estado}`,
      });
    }

    insumo.estado = estado;
    if (motivo) insumo.observaciones = motivo;
    await insumo.save();

    res.json(insumo);
  } catch (error) {
    next(error);
  }
};

// GET /api/insumos/:id/historial — historial de movimientos del insumo
const historial = async (req, res, next) => {
  try {
    const insumo = await Insumo.findByPk(req.params.id);
    if (!insumo) return res.status(404).json({ message: 'Insumo no encontrado' });

    const movimientos = await MovimientoInventario.findAll({
      where: { id_insumo: req.params.id },
      order: [['fecha', 'DESC']],
    });

    res.json({ insumo, movimientos });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listar,
  obtener,
  crear,
  editar,
  eliminarLogico,
  buscarPorQR,
  generarQR,
  registrarMovimiento,
  cambiarEstado,
  historial,
};
