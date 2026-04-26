// Controlador de usuarios: CRUD protegido solo para admins
const bcrypt = require('bcryptjs');
const { Usuario, Role, Ambulancia } = require('../models');

// Validación de contraseña segura: mínimo 8 chars, al menos 1 número y 1 símbolo
const validarPassword = (password) => {
  const regex = /^(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  return regex.test(password);
};

// GET /api/usuarios — listar todos los usuarios con su rol y ambulancia asignada (sin campo password)
const listar = async (req, res, next) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: { exclude: ['password'] },
      include: [
        { model: Role, as: 'rol', attributes: ['id', 'nombre'] },
        // Incluir ambulancia si está asignada (puede ser null para admins)
        { model: Ambulancia, as: 'ambulancia', attributes: ['id', 'codigo', 'placa'], required: false },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(usuarios);
  } catch (error) {
    next(error);
  }
};

// POST /api/usuarios — crear usuario con password hasheada
const crear = async (req, res, next) => {
  try {
    const { nombre, cedula, numero_ambulancia, email, password, roleId } = req.body;

    // cedula, numero_ambulancia y password son requeridos; email es opcional
    if (!nombre || !cedula || !numero_ambulancia || !password || !roleId) {
      return res.status(400).json({
        message: 'Nombre, cédula, número de ambulancia, password y roleId son requeridos',
      });
    }

    // Validar formato de cédula: solo dígitos, 6-15 caracteres
    if (!/^[0-9]{6,15}$/.test(cedula.trim())) {
      return res.status(400).json({
        message: 'La cédula debe contener solo dígitos y tener entre 6 y 15 caracteres',
      });
    }

    // Validar número de ambulancia no vacío
    if (!numero_ambulancia.trim()) {
      return res.status(400).json({ message: 'El número de ambulancia no puede estar vacío' });
    }

    // Validar formato de contraseña
    if (!validarPassword(password)) {
      return res.status(400).json({
        message: 'La contraseña debe tener mínimo 8 caracteres, al menos un número y un símbolo',
      });
    }

    // Verificar que la cédula no esté en uso (consulta parametrizada vía ORM)
    const cedulaExiste = await Usuario.findOne({ where: { cedula: cedula.trim() } });
    if (cedulaExiste) {
      return res.status(409).json({ message: 'La cédula ya está registrada' });
    }

    // Verificar que el rol existe
    const rolExiste = await Role.findByPk(roleId);
    if (!rolExiste) {
      return res.status(400).json({ message: 'El rol especificado no existe' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const nuevoUsuario = await Usuario.create({
      nombre,
      cedula: cedula.trim(),
      numero_ambulancia: numero_ambulancia.trim(),
      // email opcional: solo almacenar si se proporciona
      email: email ? email.toLowerCase().trim() : null,
      password: passwordHash,
      roleId,
      activo: true,
    });

    // Retornar sin la contraseña
    const { password: _, ...usuarioSinPassword } = nuevoUsuario.toJSON();
    res.status(201).json(usuarioSinPassword);
  } catch (error) {
    next(error);
  }
};

// PUT /api/usuarios/:id — editar usuario (nombre, cedula, numero_ambulancia, email, roleId, activo, ambulanciaId, password opcional)
const editar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, cedula, numero_ambulancia, email, roleId, activo, password, ambulanciaId } = req.body;

    const usuario = await Usuario.findByPk(id, {
      include: [{ model: Role, as: 'rol' }],
    });
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Actualizar solo los campos enviados
    if (nombre) usuario.nombre = nombre;

    if (cedula !== undefined) {
      // Validar formato de cédula
      if (!/^[0-9]{6,15}$/.test(cedula.trim())) {
        return res.status(400).json({
          message: 'La cédula debe contener solo dígitos y tener entre 6 y 15 caracteres',
        });
      }
      // Verificar unicidad (consulta parametrizada vía ORM)
      const cedulaExiste = await Usuario.findOne({ where: { cedula: cedula.trim() } });
      if (cedulaExiste && cedulaExiste.id !== usuario.id) {
        return res.status(409).json({ message: 'La cédula ya está en uso por otro usuario' });
      }
      usuario.cedula = cedula.trim();
    }

    if (numero_ambulancia !== undefined) {
      if (!numero_ambulancia.trim()) {
        return res.status(400).json({ message: 'El número de ambulancia no puede estar vacío' });
      }
      usuario.numero_ambulancia = numero_ambulancia.trim();
    }

    // email sigue siendo editable pero es opcional
    if (email !== undefined) {
      usuario.email = email ? email.toLowerCase().trim() : null;
    }

    if (roleId !== undefined) {
      const rolExiste = await Role.findByPk(roleId);
      if (!rolExiste) return res.status(400).json({ message: 'El rol especificado no existe' });
      usuario.roleId = roleId;
    }
    if (activo !== undefined) usuario.activo = activo;

    // Determinar el rol resultante (puede haber cambiado en esta misma petición)
    const rolResultante = roleId !== undefined
      ? (await Role.findByPk(roleId))?.nombre
      : usuario.rol?.nombre;

    // Manejar ambulanciaId según el rol:
    if (ambulanciaId !== undefined) {
      if (rolResultante === 'admin') {
        // Los admins no tienen ambulancia asignada, ignorar el valor enviado
        usuario.ambulanciaId = null;
      } else if (rolResultante === 'ambulancia') {
        if (ambulanciaId === null) {
          usuario.ambulanciaId = null;
        } else {
          // Validar que la ambulancia exista y esté activa
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
      // Si el rol cambió a admin, limpiar ambulanciaId automáticamente
      usuario.ambulanciaId = null;
    }

    // Si viene nueva contraseña, validarla y hashearla
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

// DELETE /api/usuarios/:id — desactivar usuario (soft delete), NO eliminar
const desactivar = async (req, res, next) => {
  try {
    const { id } = req.params;

    const usuario = await Usuario.findByPk(id);
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // No eliminar: solo marcar como inactivo
    usuario.activo = false;
    await usuario.save();

    res.json({ message: 'Usuario desactivado correctamente', id: usuario.id });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, crear, editar, desactivar };
