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

// Token JWT firmado con el mismo secreto que usa el middleware.
export function crearToken(payload = {}, opciones = {}) {
  const jwt = cjs('jsonwebtoken');
  return jwt.sign(
    { id: 1, numero_ambulancia: 'Administrador01', rol: 'admin', ...payload },
    process.env.JWT_SECRET,
    { expiresIn: '1h', ...opciones },
  );
}
