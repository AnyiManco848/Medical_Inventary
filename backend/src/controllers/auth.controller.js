// Controlador de autenticación: login con cédula + contraseña + número de ambulancia
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Usuario, Role, Ambulancia } = require('../models');

const login = async (req, res, next) => {
  try {
    const { cedula, password, numero_ambulancia } = req.body;

    if (!cedula || !password || !numero_ambulancia) {
      return res.status(400).json({ message: 'Cédula, contraseña y número de ambulancia son requeridos' });
    }

    // Paso 1: buscar usuario por cédula (incluir rol y ambulancia asignada)
    const usuario = await Usuario.findOne({
      where: { cedula: cedula.trim() },
      include: [
        { model: Role, as: 'rol' },
        { model: Ambulancia, as: 'ambulancia', attributes: ['id', 'codigo', 'placa'], required: false },
      ],
    });

    // Cédula no registrada en el sistema
    if (!usuario) {
      return res.status(404).json({ message: 'Cédula no registrada' });
    }

    // Verificar si la cuenta está inactiva
    if (!usuario.activo) {
      return res.status(403).json({ message: 'Cuenta desactivada. Contacte al administrador.' });
    }

    // Verificar bloqueo temporal por intentos fallidos
    if (usuario.bloqueado_hasta && new Date() < new Date(usuario.bloqueado_hasta)) {
      const minutosRestantes = Math.ceil(
        (new Date(usuario.bloqueado_hasta) - new Date()) / 60000
      );
      return res.status(403).json({
        message: `Cuenta bloqueada. Intente en ${minutosRestantes} minuto(s).`,
        bloqueado_hasta: usuario.bloqueado_hasta,
      });
    }

    // Paso 2: verificar contraseña con bcrypt
    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      // Incrementar intentos fallidos y bloquear tras 3 intentos
      usuario.intentos_fallidos += 1;

      if (usuario.intentos_fallidos >= 3) {
        const bloqueado_hasta = new Date(Date.now() + 24 * 60 * 60 * 1000);
        usuario.bloqueado_hasta = bloqueado_hasta;
        usuario.intentos_fallidos = 0;
        await usuario.save();
        return res.status(403).json({
          message: 'Cuenta bloqueada por 24 horas debido a múltiples intentos fallidos.',
          bloqueado_hasta,
        });
      }

      await usuario.save();
      return res.status(401).json({
        message: `Contraseña incorrecta. Intentos restantes: ${3 - usuario.intentos_fallidos}`,
      });
    }

    // Paso 3: verificar que el número de ambulancia coincida con el registrado para este usuario
    if (usuario.numero_ambulancia !== numero_ambulancia.trim()) {
      return res.status(401).json({ message: 'Número de ambulancia no válido para este usuario' });
    }

    // Login exitoso: resetear contador de intentos
    usuario.intentos_fallidos = 0;
    usuario.bloqueado_hasta = null;
    await usuario.save();

    // Generar JWT — payload usa cedula como identificador (no email)
    const payload = {
      id: usuario.id,
      cedula: usuario.cedula,
      rol: usuario.rol.nombre,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    return res.status(200).json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        cedula: usuario.cedula,
        rol: usuario.rol.nombre,
        // Incluir ambulancia asignada (null si es admin o no tiene asignada)
        ambulancia: usuario.ambulancia
          ? { id: usuario.ambulancia.id, codigo: usuario.ambulancia.codigo, placa: usuario.ambulancia.placa }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login };
