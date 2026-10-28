import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { cjs, crearToken } from '../helpers.js';

const bcrypt = cjs('bcryptjs');
const { Usuario, CentroAsistencial, Ambulancia } = cjs('../src/models');
const app = cjs('../src/app');

const tokenAdmin = () => crearToken({ id: 1, rol: 'admin' });
const tokenAmbulancia = () => crearToken({ id: 2, numero_ambulancia: 'Ambulancia01', rol: 'ambulancia' });

beforeEach(() => {
  // El manejador global de errores escribe en consola; se silencia en pruebas
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/health', () => {
  it('responde 200 con status ok y una marca de tiempo ISO', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });

  it('no envía la cabecera X-Powered-By (no revela que el servidor es Express)', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Rutas protegidas: sin token → 401', () => {
  it.each([
    ['get', '/api/usuarios'],
    ['get', '/api/ambulancias/activas'],
    ['get', '/api/insumos'],
    ['get', '/api/centros'],
    ['get', '/api/reportes/mis-entregas'],
    ['get', '/api/reportes/admin/historial'],
    ['get', '/api/movimientos/historial'],
    ['post', '/api/movimientos/entrega'],
    ['post', '/api/movimientos/recogida'],
  ])('%s %s', async (metodo, ruta) => {
    const res = await request(app)[metodo](ruta);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token de autenticación requerido');
  });

  it('un token inválido también devuelve 401', async () => {
    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', 'Bearer token-falso');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token inválido');
  });
});

describe('Control de roles: ambulancia no accede a rutas de admin → 403', () => {
  it.each([
    ['get', '/api/usuarios'],
    ['post', '/api/usuarios'],
    ['get', '/api/centros'],
    ['get', '/api/ambulancias/todas'],
    ['post', '/api/ambulancias'],
    ['get', '/api/reportes/admin/historial'],
    ['get', '/api/reportes/admin/pendientes'],
  ])('%s %s', async (metodo, ruta) => {
    const res = await request(app)[metodo](ruta).set('Authorization', `Bearer ${tokenAmbulancia()}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Acceso denegado');
  });

  it('un admin no puede usar /api/reportes/mis-entregas (solo rol ambulancia)', async () => {
    const res = await request(app)
      .get('/api/reportes/mis-entregas')
      .set('Authorization', `Bearer ${tokenAdmin()}`);

    expect(res.status).toBe(403);
  });
});

describe('Rutas con acceso permitido', () => {
  it('GET /api/centros-asistenciales es pública (sin token)', async () => {
    vi.spyOn(CentroAsistencial, 'findAll').mockResolvedValue([{ id: 1, nombre: 'Hospital A' }]);

    const res = await request(app).get('/api/centros-asistenciales');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, nombre: 'Hospital A' }]);
  });

  it('GET /api/usuarios con token de admin → 200', async () => {
    vi.spyOn(Usuario, 'findAll').mockResolvedValue([{ id: 1, nombre: 'Admin' }]);

    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, nombre: 'Admin' }]);
  });

  it('GET /api/ambulancias/activas está disponible para cualquier usuario autenticado', async () => {
    vi.spyOn(Ambulancia, 'findAll').mockResolvedValue([{ id: 1, codigo: 'AMB-01' }]);

    const res = await request(app)
      .get('/api/ambulancias/activas')
      .set('Authorization', `Bearer ${tokenAmbulancia()}`);

    expect(res.status).toBe(200);
    expect(res.body[0].codigo).toBe('AMB-01');
  });
});

describe('POST /api/auth/login (flujo completo por HTTP)', () => {
  it('400 si el cuerpo viene vacío', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Usuario y contraseña son requeridos' });
  });

  it('200 con credenciales válidas y el token sirve para entrar a una ruta de admin', async () => {
    const hash = bcrypt.hashSync('Clave123*', 4);
    vi.spyOn(Usuario, 'findOne').mockResolvedValue({
      id: 1,
      nombre: 'Administrador 01',
      numero_ambulancia: 'Administrador01',
      password: hash,
      activo: true,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      rol: { nombre: 'admin' },
      ambulancia: null,
      save: vi.fn().mockResolvedValue(undefined),
    });
    vi.spyOn(Usuario, 'findAll').mockResolvedValue([]);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ numero_ambulancia: 'Administrador01', password: 'Clave123*' });

    expect(login.status).toBe(200);
    const payload = cjs('jsonwebtoken').verify(login.body.token, process.env.JWT_SECRET);
    expect(payload).toMatchObject({ id: 1, numero_ambulancia: 'Administrador01', rol: 'admin' });
    expect(login.body.usuario.rol).toBe('admin');

    const protegida = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(protegida.status).toBe(200);
  });
});

describe('Manejo global de errores', () => {
  it('un fallo de base de datos se devuelve como 500 con mensaje', async () => {
    vi.spyOn(Usuario, 'findAll').mockRejectedValue(new Error('Conexión perdida'));

    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin()}`);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Conexión perdida');
  });

  it('en producción/pruebas no expone el stack trace', async () => {
    vi.spyOn(Usuario, 'findAll').mockRejectedValue(new Error('boom'));

    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${tokenAdmin()}`);

    expect(res.body).not.toHaveProperty('stack');
  });

  it('una ruta inexistente responde 404', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.status).toBe(404);
  });
});

describe('CORS', () => {
  it('permite el origen del frontend configurado', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('no refleja orígenes desconocidos', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://sitio-malicioso.com');

    expect(res.headers['access-control-allow-origin']).not.toBe('http://sitio-malicioso.com');
  });
});
