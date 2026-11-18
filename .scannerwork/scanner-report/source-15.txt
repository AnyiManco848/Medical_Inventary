const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Usuario, Role, Ambulancia } = require('../models');

const login = async (req, res, next) => {
  try {
    const { numero_ambulancia, password } = req.body;

    if (!numero_ambulancia || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña son requeridos' });
    }

    const usuario = await Usuario.findOne({
      where: { numero_ambulancia: numero_ambulancia.trim() },
      include: [
        { model: Role, as: 'rol' },
        { model: Ambulancia, as: 'ambulancia', attributes: ['id', 'codigo', 'placa'], required: false },
      ],
    });

    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no registrado' });
    }

    if (!usuario.activo) {
      return res.status(403).json({ message: 'Cuenta desactivada. Contacte al administrador.' });
    }

    if (usuario.bloqueado_hasta && new Date() < new Date(usuario.bloqueado_hasta)) {
      const minutosRestantes = Math.ceil(
        (new Date(usuario.bloqueado_hasta) - new Date()) / 60000
      );
      return res.status(403).json({
        message: `Cuenta bloqueada. Intente en ${minutosRestantes} minuto(s).`,
        bloqueado_hasta: usuario.bloqueado_hasta,
      });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
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

    usuario.intentos_fallidos = 0;
    usuario.bloqueado_hasta = null;
    await usuario.save();

    const payload = {
      id: usuario.id,
      numero_ambulancia: usuario.numero_ambulancia,
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
        numero_ambulancia: usuario.numero_ambulancia,
        rol: usuario.rol.nombre,
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
