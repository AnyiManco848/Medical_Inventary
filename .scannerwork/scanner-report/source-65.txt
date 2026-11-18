import { describe, it, expect, vi } from 'vitest';
import { cjs, crearRes, crearToken } from '../helpers.js';

const { verificarToken } = cjs('../src/middlewares/auth.middleware');
const { verificarRol } = cjs('../src/middlewares/role.middleware');

describe('verificarToken (auth.middleware)', () => {
  it('responde 401 si no hay header Authorization', () => {
    const req = { headers: {} };
    const res = crearRes();
    const next = vi.fn();

    verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token de autenticación requerido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 si el header no empieza por "Bearer "', () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = crearRes();
    const next = vi.fn();

    verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 "Token inválido" si el token está mal formado', () => {
    const req = { headers: { authorization: 'Bearer esto.no.es.un.jwt' } };
    const res = crearRes();
    const next = vi.fn();

    verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token inválido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 "Token inválido" si fue firmado con otro secreto', () => {
    const jwt = cjs('jsonwebtoken');
    const tokenAjeno = jwt.sign({ id: 1, rol: 'admin' }, 'otro-secreto');
    const req = { headers: { authorization: `Bearer ${tokenAjeno}` } };
    const res = crearRes();
    const next = vi.fn();

    verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token inválido' });
  });

  it('responde 401 con mensaje de expiración si el token venció', () => {
    const token = crearToken({}, { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = crearRes();
    const next = vi.fn();

    verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Token expirado. Inicie sesión nuevamente.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('con token válido llena req.usuario y llama a next()', () => {
    const token = crearToken({ id: 7, numero_ambulancia: 'Ambulancia07', rol: 'ambulancia' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = crearRes();
    const next = vi.fn();

    verificarToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.usuario).toMatchObject({ id: 7, numero_ambulancia: 'Ambulancia07', rol: 'ambulancia' });
  });
});

describe('verificarRol (role.middleware)', () => {
  it('responde 401 si no hay usuario autenticado', () => {
    const req = {};
    const res = crearRes();
    const next = vi.fn();

    verificarRol('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No autenticado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 403 si el rol no está permitido', () => {
    const req = { usuario: { rol: 'ambulancia' } };
    const res = crearRes();
    const next = vi.fn();

    verificarRol('admin')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Acceso denegado. Se requiere rol: admin',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar si el rol está permitido', () => {
    const req = { usuario: { rol: 'admin' } };
    const res = crearRes();
    const next = vi.fn();

    verificarRol('admin')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('acepta varios roles y lista todos en el mensaje de error', () => {
    const middleware = verificarRol('admin', 'supervisor');

    const okRes = crearRes();
    const okNext = vi.fn();
    middleware({ usuario: { rol: 'supervisor' } }, okRes, okNext);
    expect(okNext).toHaveBeenCalledTimes(1);

    const badRes = crearRes();
    middleware({ usuario: { rol: 'ambulancia' } }, badRes, vi.fn());
    expect(badRes.status).toHaveBeenCalledWith(403);
    expect(badRes.json).toHaveBeenCalledWith({
      message: 'Acceso denegado. Se requiere rol: admin o supervisor',
    });
  });
});
