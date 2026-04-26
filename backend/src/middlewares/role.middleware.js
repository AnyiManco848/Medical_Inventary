// Middleware de roles: restringe acceso según el rol del usuario autenticado
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        message: `Acceso denegado. Se requiere rol: ${rolesPermitidos.join(' o ')}`,
      });
    }

    next();
  };
};

module.exports = { verificarRol };
