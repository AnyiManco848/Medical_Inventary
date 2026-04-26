const express = require('express');
const router = express.Router();
const { Ambulancia } = require('../models');
const { verificarToken } = require('../middlewares/auth.middleware');

// Todas las rutas requieren JWT válido
router.use(verificarToken);

// GET /api/ambulancias — retorna todas las ambulancias activas
router.get('/', async (req, res, next) => {
  try {
    const ambulancias = await Ambulancia.findAll({
      where: { activa: true },
      attributes: ['id', 'codigo', 'placa', 'descripcion'],
      order: [['codigo', 'ASC']],
    });
    res.json(ambulancias);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
