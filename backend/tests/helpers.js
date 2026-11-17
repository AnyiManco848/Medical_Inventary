import { vi } from 'vitest';
import { createRequire } from 'node:module';

// Permite cargar los módulos CommonJS del backend desde los tests (ESM).
export const cjs = createRequire(import.meta.url);

// Respuesta falsa de Express: status() y json() encadenables.
export function crearRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

// Cifra la contraseña como lo hace el frontend: RSA-OAEP/SHA-256 sobre {"password", "ts"} en base64.
// Por defecto usa la clave pública que expone el backend en GET /api/auth/public-key.
export function cifrarParaLogin(password, { ts = Date.now(), publicKey } = {}) {
  const crypto = cjs('node:crypto');
  const spki = publicKey ?? cjs('../src/config/loginRsa').obtenerClavePublica();
  const clave = crypto.createPublicKey({ key: Buffer.from(spki, 'base64'), format: 'der', type: 'spki' });
  return crypto.publicEncrypt(
    { key: clave, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(JSON.stringify({ password, ts })),
  ).toString('base64');
}

// Token JWT firmado con el mismo secreto que usa el middleware.
export function crearToken(payload = {}, opciones = {}) {
  const jwt = cjs('jsonwebtoken');
  return jwt.sign(
    { id: 1, numero_ambulancia: 'Administrador01', rol: 'admin', ...payload },
    process.env.JWT_SECRET,
    { expiresIn: '1h', ...opciones },
  );
}
