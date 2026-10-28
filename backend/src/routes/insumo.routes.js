const express = require('express');
const router = express.Router();
const upload = require('../config/upload');
const { verificarToken } = require('../middlewares/auth.middleware');
const { verificarRol } = require('../middlewares/role.middleware');
const {
  listar, listarBajas, obtener, buscar, buscarPorQR,
  crear, editar, darDeBaja, reasignar, generarQR,
  historialReasignaciones, eliminarLogico, cambiarEstado, historial,
  registrarMovimiento,
} = require('../controllers/insumo.controller');

router.use(verificarToken);

// Lectura: cualquier usuario autenticado (admin y ambulancia consultan, buscan y escanean QR).
// Escritura: solo admin gestiona insumos (regla de negocio del README).
const soloAdmin = verificarRol('admin');

// Rutas específicas ANTES de :id para evitar colisiones de parámetros
router.get('/bajas', listarBajas);
router.get('/buscar', buscar);
router.get('/qr/:codigo', buscarPorQR);
router.get('/', listar);
router.post('/', soloAdmin, crear);

router.get('/:id', obtener);
router.put('/:id', soloAdmin, editar);
router.delete('/:id', soloAdmin, eliminarLogico);

// El rol se comprueba antes de multer para no guardar la foto de alguien sin permiso
router.post('/:id/baja', soloAdmin, upload.single('foto'), darDeBaja);
router.post('/:id/reasignar', soloAdmin, reasignar);
router.get('/:id/qr', generarQR);
router.get('/:id/reasignaciones', historialReasignaciones);

// Legacy. /movimiento no escribe nada: responde 410 a cualquier usuario.
router.post('/:id/movimiento', registrarMovimiento);
router.put('/:id/estado', soloAdmin, cambiarEstado);
router.get('/:id/historial', historial);

module.exports = router;
