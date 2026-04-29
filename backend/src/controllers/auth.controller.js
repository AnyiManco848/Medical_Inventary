// Controlador de autenticación: login con usuario (numero_ambulancia) + contraseña
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Usuario, Role, Ambulancia } = require('../models');

const login = async (req, res, next) => {
  try {
    const { usuario, password } = req.body;

    if (!usuario || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }

    // Paso 1: buscar usuario por numero_ambulancia (identificador de acceso)
    const usuarioEncontrado = await Usuario.findOne({
      where: { numero_ambulancia: usuario.trim() },
      include: [
        { model: Role, as: 'rol' },
        { model: Ambulancia, as: 'ambulancia', attributes: ['id', 'codigo', 'placa'], required: false },
      ],
    });

    if (!usuarioEncontrado) {
      return res.status(404).json({ message: 'Usuario no registrado' });
    }

    // Verificar si la cuenta está inactiva
    if (!usuarioEncontrado.activo) {
      return res.status(403).json({ message: 'Cuenta desactivada. Contacte al administrador.' });
    }

    // Verificar bloqueo temporal por intentos fallidos
    if (usuarioEncontrado.bloqueado_hasta && new Date() < new Date(usuarioEncontrado.bloqueado_hasta)) {
      const minutosRestantes = Math.ceil(
        (new Date(usuarioEncontrado.bloqueado_hasta) - new Date()) / 60000
      );
      return res.status(403).json({
        message: `Cuenta bloqueada. Intente en ${minutosRestantes} minuto(s).`,
        bloqueado_hasta: usuarioEncontrado.bloqueado_hasta,
      });
    }

    // Paso 2: verificar contraseña con bcrypt
    const passwordValida = await bcrypt.compare(password, usuarioEncontrado.password);

    if (!passwordValida) {
      // Incrementar intentos fallidos y bloquear tras 3 intentos
      usuarioEncontrado.intentos_fallidos += 1;

      if (usuarioEncontrado.intentos_fallidos >= 3) {
        const bloqueado_hasta = new Date(Date.now() + 24 * 60 * 60 * 1000);
        usuarioEncontrado.bloqueado_hasta = bloqueado_hasta;
        usuarioEncontrado.intentos_fallidos = 0;
        await usuarioEncontrado.save();
        return res.status(403).json({
          message: 'Cuenta bloqueada por 24 horas debido a múltiples intentos fallidos.',
          bloqueado_hasta,
        });
      }

      await usuarioEncontrado.save();
      return res.status(401).json({
        message: `Contraseña incorrecta. Intentos restantes: ${3 - usuarioEncontrado.intentos_fallidos}`,
      });
    }

    // Login exitoso: resetear contador de intentos
    usuarioEncontrado.intentos_fallidos = 0;
    usuarioEncontrado.bloqueado_hasta = null;
    await usuarioEncontrado.save();

    const payload = {
      id: usuarioEncontrado.id,
      numero_ambulancia: usuarioEncontrado.numero_ambulancia,
      rol: usuarioEncontrado.rol.nombre,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    return res.status(200).json({
      token,
      usuario: {
        id: usuarioEncontrado.id,
        nombre: usuarioEncontrado.nombre,
        numero_ambulancia: usuarioEncontrado.numero_ambulancia,
        rol: usuarioEncontrado.rol.nombre,
        ambulancia: usuarioEncontrado.ambulancia
          ? { id: usuarioEncontrado.ambulancia.id, codigo: usuarioEncontrado.ambulancia.codigo, placa: usuarioEncontrado.ambulancia.placa }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login };
