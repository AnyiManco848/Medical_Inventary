const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const { getCentros, crearEntrega, getHistorial } = require('../controllers/movimientos.controller');

// Sin auth — lista de referencia pública
router.get('/centros-asistenciales', getCentros);

// Requieren JWT
router.post('/movimientos/entrega',   verificarToken, crearEntrega);
router.get('/movimientos/historial',  verificarToken, getHistorial);

module.exports = router;
