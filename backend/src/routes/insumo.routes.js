const express = require('express');
const router = express.Router();
const upload = require('../config/upload');
const { verificarToken } = require('../middlewares/auth.middleware');
const {
  listar, obtener, crear, editar, eliminarLogico,
  buscarPorQR, generarQR, registrarMovimiento, cambiarEstado, historial,
} = require('../controllers/insumo.controller');

// Todos los endpoints requieren JWT válido
router.use(verificarToken);

// Rutas específicas ANTES de las rutas con parámetro :id para evitar colisiones
router.get('/qr/:codigo', buscarPorQR);
router.get('/', listar);
router.post('/', upload.single('imagen'), crear);
router.get('/:id', obtener);
router.put('/:id', upload.single('imagen'), editar);
router.delete('/:id', eliminarLogico);
router.get('/:id/qr', generarQR);
router.post('/:id/movimiento', registrarMovimiento);
router.put('/:id/estado', cambiarEstado);
router.get('/:id/historial', historial);

module.exports = router;
