const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth.middleware');
const uploadEvidencia = require('../config/uploadEvidencia');
const {
  getCentros, crearEntrega, getHistorial,
  ultimoPorInsumo, crearRecogida, crearDanoPerdida,
} = require('../controllers/movimientos.controller');

// Sin auth — lista de referencia pública
router.get('/centros-asistenciales', getCentros);

// Requieren JWT
router.post('/movimientos/entrega',          verificarToken, crearEntrega);
router.get('/movimientos/historial',         verificarToken, getHistorial);
router.get('/movimientos/ultimo-por-insumo', verificarToken, ultimoPorInsumo);
router.post('/movimientos/recogida',         verificarToken, crearRecogida);
router.post('/movimientos/dano-perdida',     verificarToken, uploadEvidencia.array('fotos', 5), crearDanoPerdida);

module.exports = router;
