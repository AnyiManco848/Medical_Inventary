const express = require('express');
const router = express.Router();
const { login, clavePublica } = require('../controllers/auth.controller');

// GET /api/auth/public-key → { publicKey } (SPKI base64) para cifrar la contraseña del login
router.get('/public-key', clavePublica);

// POST /api/auth/login → { numero_ambulancia, password_cifrada }
// Pendiente: rate limiting por IP (p. ej. express-rate-limit); hoy solo existe el bloqueo
// de la cuenta tras 3 intentos fallidos.
router.post('/login', login);

module.exports = router;
