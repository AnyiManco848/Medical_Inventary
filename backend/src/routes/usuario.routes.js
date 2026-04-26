const express = require('express');
const router = express.Router();
const { listar, crear, editar, desactivar } = require('../controllers/usuario.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { verificarRol } = require('../middlewares/role.middleware');

// Todas las rutas de usuarios requieren JWT válido + rol admin
router.use(verificarToken);
router.use(verificarRol('admin'));

router.get('/', listar);
router.post('/', crear);
router.put('/:id', editar);
router.delete('/:id', desactivar);

module.exports = router;
