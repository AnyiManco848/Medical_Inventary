const bcrypt = require('bcryptjs');
const { Usuario, Role, Ambulancia } = require('../models');

const validarPassword = (password) => {
  const regex = /^(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  return regex.test(password);
};

const listar = async (req, res, next) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: { exclude: ['password'] },
      include: [
        { model: Role, as: 'rol', attributes: ['id', 'nombre'] },
        { model: Ambulancia, as: 'ambulancia', attributes: ['id', 'codigo', 'placa'], required: false },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(usuarios);
  } catch (error) {
    next(error);
  }
};

const crear = async (req, res, next) => {
  try {
    const { nombre, numero_ambulancia, password, roleId } = req.body;

    if (!nombre || !numero_ambulancia || !password || !roleId) {
      return res.status(400).json({
        message: 'Nombre, número de ambulancia/usuario, password y roleId son requeridos',
      });
    }

    if (!numero_ambulancia.trim()) {
      return res.status(400).json({ message: 'El número de ambulancia/usuario no puede estar vacío' });
    }

    if (!validarPassword(password)) {
      return res.status(400).json({
        message: 'La contraseña debe tener mínimo 8 caracteres, al menos un número y un símbolo',
      });
    }

    const existe = await Usuario.findOne({ where: { numero_ambulancia: numero_ambulancia.trim() } });
    if (existe) {
      return res.status(409).json({ message: 'El número de ambulancia/usuario ya está registrado' });
    }

    const rolExiste = await Role.findByPk(roleId);
    if (!rolExiste) {
      return res.status(400).json({ message: 'El rol especificado no existe' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const nuevoUsuario = await Usuario.create({
      nombre,
      numero_ambulancia: numero_ambulancia.trim(),
      password: passwordHash,
      roleId,
      activo: true,
    });

    const { password: _, ...usuarioSinPassword } = nuevoUsuario.toJSON();
    res.status(201).json(usuarioSinPassword);
  } catch (error) {
    next(error);
  }
};

const editar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, numero_ambulancia, roleId, activo, password, ambulanciaId } = req.body;

    const usuario = await Usuario.findByPk(id, {
      include: [{ model: Role, as: 'rol' }],
    });
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (nombre) usuario.nombre = nombre;

    if (numero_ambulancia !== undefined) {
      if (!numero_ambulancia.trim()) {
        return res.status(400).json({ message: 'El número de ambulancia/usuario no puede estar vacío' });
      }
      const existe = await Usuario.findOne({ where: { numero_ambulancia: numero_ambulancia.trim() } });
      if (existe && existe.id !== usuario.id) {
        return res.status(409).json({ message: 'El número de ambulancia/usuario ya está en uso por otro usuario' });
      }
      usuario.numero_ambulancia = numero_ambulancia.trim();
    }

    if (roleId !== undefined) {
      const rolExiste = await Role.findByPk(roleId);
      if (!rolExiste) return res.status(400).json({ message: 'El rol especificado no existe' });
      usuario.roleId = roleId;
    }
    if (activo !== undefined) usuario.activo = activo;

    const rolResultante = roleId !== undefined
      ? (await Role.findByPk(roleId))?.nombre
      : usuario.rol?.nombre;

    if (ambulanciaId !== undefined) {
      if (rolResultante === 'admin') {
        usuario.ambulanciaId = null;
      } else if (rolResultante === 'ambulancia') {
        if (ambulanciaId === null) {
          usuario.ambulanciaId = null;
        } else {
          const ambulanciaExiste = await Ambulancia.findOne({
            where: { id: ambulanciaId, activa: true },
          });
          if (!ambulanciaExiste) {
            return res.status(400).json({ message: 'La ambulancia especificada no existe o está inactiva' });
          }
          usuario.ambulanciaId = ambulanciaId;
        }
      }
    } else if (rolResultante === 'admin') {
      usuario.ambulanciaId = null;
    }

    if (password) {
      if (!validarPassword(password)) {
        return res.status(400).json({
          message: 'La contraseña debe tener mínimo 8 caracteres, al menos un número y un símbolo',
        });
      }
      usuario.password = await bcrypt.hash(password, 12);
    }

    await usuario.save();

    const { password: _, ...usuarioSinPassword } = usuario.toJSON();
    res.json(usuarioSinPassword);
  } catch (error) {
    next(error);
  }
};

const desactivar = async (req, res, next) => {
  try {
    const { id } = req.params;

    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    usuario.activo = false;
    await usuario.save();

    res.json({ message: 'Usuario desactivado correctamente', id: usuario.id });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, crear, editar, desactivar };
