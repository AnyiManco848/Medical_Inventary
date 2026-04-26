const express = require('express');
const router = express.Router();
const upload = require('../config/upload');
const { verificarToken } = require('../middlewares/auth.middleware');
const {
  listar, listarBajas, obtener, buscarPorCodigo, buscarPorQR,
  crear, editar, darDeBaja, reasignar, generarQR,
  historialReasignaciones, eliminarLogico, cambiarEstado, historial,
  registrarMovimiento,
} = require('../controllers/insumo.controller');

router.use(verificarToken);

// Rutas específicas ANTES de :id para evitar colisiones de parámetros
router.get('/bajas', listarBajas);
router.get('/buscar/:codigo', buscarPorCodigo);
router.get('/qr/:codigo', buscarPorQR);
router.get('/', listar);
router.post('/', crear);

router.get('/:id', obtener);
router.put('/:id', editar);
router.delete('/:id', eliminarLogico);

router.post('/:id/baja', upload.single('foto'), darDeBaja);
router.post('/:id/reasignar', reasignar);
router.get('/:id/qr', generarQR);
router.get('/:id/reasignaciones', historialReasignaciones);

// Legacy
router.post('/:id/movimiento', registrarMovimiento);
router.put('/:id/estado', cambiarEstado);
router.get('/:id/historial', historial);

module.exports = router;
