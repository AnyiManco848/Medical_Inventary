const express = require('express');
const router = express.Router();
const { Ambulancia } = require('../models');
const { verificarToken } = require('../middlewares/auth.middleware');
const { verificarRol }   = require('../middlewares/role.middleware');
const { listar, crear, editar, toggleActiva, eliminar } = require('../controllers/ambulancia.controller');

router.use(verificarToken);

const getActivas = async (req, res, next) => {
  try {
    const ambulancias = await Ambulancia.findAll({
      where:      { activa: true },
      attributes: ['id', 'codigo', 'placa', 'descripcion'],
      order:      [['codigo', 'ASC']],
    });
    res.json(ambulancias);
  } catch (error) {
    next(error);
  }
};

// Rutas públicas (cualquier usuario autenticado) — usadas por formularios
router.get('/activas', getActivas);
router.get('/',        getActivas);

// Rutas de administración
router.get('/todas',       verificarRol('admin'), listar);
router.post('/',           verificarRol('admin'), crear);
router.put('/:id',         verificarRol('admin'), editar);
router.patch('/:id/toggle', verificarRol('admin'), toggleActiva);
router.delete('/:id',      verificarRol('admin'), eliminar);

module.exports = router;
