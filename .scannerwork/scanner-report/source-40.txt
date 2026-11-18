const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const { verificarRol }   = require('../middlewares/role.middleware');
const { listar, crear, editar, toggleActivo, eliminar } = require('../controllers/centros.controller');

router.use(verificarToken);
router.use(verificarRol('admin'));

router.get('/',               listar);
router.post('/',              crear);
router.put('/:id',            editar);
router.patch('/:id/toggle',   toggleActivo);
router.delete('/:id',         eliminar);

module.exports = router;
