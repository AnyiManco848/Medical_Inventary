const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const { verificarRol }   = require('../middlewares/role.middleware');
const { getMisEntregas, getAdminHistorial, getAdminPendientes } = require('../controllers/reportes.controller');

// Solo usuario ambulancia puede ver sus propias entregas
router.get('/mis-entregas',      verificarToken, verificarRol('ambulancia'), getMisEntregas);

// Solo administrador puede ver el historial completo y los pendientes
router.get('/admin/historial',   verificarToken, verificarRol('admin'), getAdminHistorial);
router.get('/admin/pendientes',  verificarToken, verificarRol('admin'), getAdminPendientes);

module.exports = router;
