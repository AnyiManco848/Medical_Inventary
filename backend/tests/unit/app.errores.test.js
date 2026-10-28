import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { cjs, crearToken } from '../helpers.js';

const multer = cjs('multer');
const { Usuario, Insumo, Ambulancia, BajaInsumo, ReasignacionAmbulancia, sequelize } = cjs('../src/models');
const app = cjs('../src/app');

const tokenAdmin = () => crearToken({ id: 1, rol: 'admin' });
const tokenAmbulancia = () => crearToken({ id: 2, numero_ambulancia: 'Ambulancia01', rol: 'ambulancia' });

// GET /api/usuarios (admin) llega al manejador global si Usuario.findAll falla
const pedirUsuarios = () => request(app).get('/api/usuarios').set('Authorization', `Bearer ${tokenAdmin()}`);

let nodeEnv;

beforeEach(() => {
  nodeEnv = process.env.NODE_ENV;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.env.NODE_ENV = nodeEnv;
});

describe('app.js · manejador global de errores', () => {
  it('respeta err.status y el mensaje del error', async () => {
    vi.spyOn(Usuario, 'findAll').mockRejectedValue(Object.assign(new Error('No disponible'), { status: 503 }));

    const res = await pedirUsuarios();

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ message: 'No disponible' });
  });

  it('sin mensaje responde 500 con "Error interno del servidor"', async () => {
    vi.spyOn(Usuario, 'findAll').mockRejectedValue(new Error(''));

    const res = await pedirUsuarios();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Error interno del servidor' });
  });

  it('un error sin propiedad message (p. ej. un objeto rechazado) responde 500 sin romper el manejador', async () => {
    vi.spyOn(Usuario, 'findAll').mockRejectedValue({ status: 500 });

    const res = await pedirUsuarios();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'Error interno del servidor' });
  });

  it('registra el error en consola con el prefijo [ERROR]', async () => {
    vi.spyOn(Usuario, 'findAll').mockRejectedValue(new Error('fallo de prueba'));

    await pedirUsuarios();

    expect(console.error).toHaveBeenCalledWith('[ERROR]', 'fallo de prueba');
  });

  it('en development incluye el stack para depurar', async () => {
    process.env.NODE_ENV = 'development';
    const error = new Error('con stack');
    vi.spyOn(Usuario, 'findAll').mockRejectedValue(error);

    const res = await pedirUsuarios();

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('con stack');
    expect(res.body.stack).toBe(error.stack);
  });

  it('en production no incluye el stack', async () => {
    process.env.NODE_ENV = 'production';
    vi.spyOn(Usuario, 'findAll').mockRejectedValue(new Error('sin stack'));

    const res = await pedirUsuarios();

    expect(res.body).toEqual({ message: 'sin stack' });
  });

  it('un error "Solo se permiten..." responde 400 aunque traiga otro status', async () => {
    vi.spyOn(Usuario, 'findAll').mockRejectedValue(
      Object.assign(new Error('Solo se permiten imágenes JPG o PNG'), { status: 500 }),
    );

    const res = await pedirUsuarios();

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Solo se permiten imágenes JPG o PNG' });
  });

  it('flujo real: subir un archivo .txt como foto de baja responde 400 y no llega al controlador', async () => {
    const findByPk = vi.spyOn(Insumo, 'findByPk');

    const res = await request(app)
      .post('/api/insumos/1/baja')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .field('motivo', 'Vencido')
      .attach('foto', Buffer.from('no soy una imagen'), { filename: 'nota.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Solo se permiten imágenes JPG o PNG' });
    expect(findByPk).not.toHaveBeenCalled();
  });

  it('una foto que supera el límite de tamaño (MulterError LIMIT_FILE_SIZE) responde 413 en español', async () => {
    vi.spyOn(Usuario, 'findAll').mockRejectedValue(new multer.MulterError('LIMIT_FILE_SIZE', 'foto'));

    const res = await pedirUsuarios();

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: 'El archivo es demasiado grande. Reduce el tamaño de la imagen e inténtalo de nuevo.' });
  });

  it('un archivo real de más de 5 MB en la baja responde 413 sin llegar al controlador', async () => {
    const findByPk = vi.spyOn(Insumo, 'findByPk');

    const res = await request(app)
      .post('/api/insumos/1/baja')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .field('motivo', 'roto')
      .attach('foto', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'grande.png', contentType: 'image/png' });

    expect(res.status).toBe(413);
    expect(findByPk).not.toHaveBeenCalled();
  });
});

describe('routes/ambulancia.routes.js · GET /api/ambulancias', () => {
  it('lista solo ambulancias activas con los campos públicos', async () => {
    const spy = vi.spyOn(Ambulancia, 'findAll').mockResolvedValue([{ id: 1, codigo: 'AMB-01' }]);

    const res = await request(app).get('/api/ambulancias').set('Authorization', `Bearer ${tokenAmbulancia()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, codigo: 'AMB-01' }]);
    expect(spy).toHaveBeenCalledWith({
      where: { activa: true },
      attributes: ['id', 'codigo', 'placa', 'descripcion'],
      order: [['codigo', 'ASC']],
    });
  });

  it('si la consulta falla responde 500 por el manejador global', async () => {
    vi.spyOn(Ambulancia, 'findAll').mockRejectedValue(new Error('BD caída'));

    const res = await request(app).get('/api/ambulancias/activas').set('Authorization', `Bearer ${tokenAmbulancia()}`);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: 'BD caída' });
  });
});

// Control de acceso de routes/insumo.routes.js: escribir insumos es solo de admin (regla de negocio);
// el rol ambulancia solo consulta, busca y escanea QR.
describe('routes/insumo.routes.js · control de acceso por rol', () => {
  let insumo;
  beforeEach(() => {
    insumo = {
      id: 1, codigo: 'INS-COL-001', nombre: 'Collarín', familia: 'Collarín', estado: 'activo',
      ambulanciaId: 2, ambulancia: null, save: vi.fn().mockResolvedValue(undefined),
      toJSON() { return { id: 1, codigo: 'INS-COL-001' }; },
    };
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumo);
    vi.spyOn(Insumo, 'findAll').mockResolvedValue([insumo]);
    vi.spyOn(Insumo, 'findOne').mockResolvedValue(insumo);
    vi.spyOn(Insumo, 'create').mockResolvedValue(insumo);
    vi.spyOn(sequelize, 'transaction').mockResolvedValue({ commit: vi.fn(), rollback: vi.fn() });
    vi.spyOn(sequelize, 'query').mockResolvedValue([[{ valor: 1 }]]);
    vi.spyOn(BajaInsumo, 'create').mockResolvedValue({ id: 9, toJSON: () => ({ id: 9 }) });
    vi.spyOn(BajaInsumo, 'findAll').mockResolvedValue([]);
  });

  const ESCRITURAS = [
    ['POST', '/api/insumos', { nombre: 'Collarín', familia: 'Collarín', familia_abrev: 'COL' }],
    ['PUT', '/api/insumos/1', { nombre: 'Collarín M' }],
    ['DELETE', '/api/insumos/1', { motivo: 'prueba' }],
    ['POST', '/api/insumos/1/baja', { motivo: 'roto' }],
    ['POST', '/api/insumos/1/reasignar', { ambulancia_nueva_id: null, tipo: 'permanente' }],
    ['PUT', '/api/insumos/1/estado', { estado: 'activo' }],
  ];
  const enviar = (metodo, url, token) => {
    const req = request(app)[metodo.toLowerCase()](url);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it.each(ESCRITURAS)('%s %s sin token responde 401', async (metodo, url, body) => {
    const res = await enviar(metodo, url).send(body);

    expect(res.status).toBe(401);
  });

  it.each(ESCRITURAS)('%s %s con rol ambulancia responde 403 y no toca la base', async (metodo, url, body) => {
    const res = await enviar(metodo, url, tokenAmbulancia()).send(body);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Acceso denegado. Se requiere rol: admin' });
    expect(Insumo.findByPk).not.toHaveBeenCalled();
    expect(Insumo.create).not.toHaveBeenCalled();
    expect(BajaInsumo.create).not.toHaveBeenCalled();
    expect(insumo.save).not.toHaveBeenCalled();
  });

  it('la baja con rol ambulancia se rechaza antes de recibir la foto', async () => {
    const res = await request(app)
      .post('/api/insumos/1/baja')
      .set('Authorization', `Bearer ${tokenAmbulancia()}`)
      .field('motivo', 'roto')
      .attach('foto', Buffer.from('png'), { filename: 'foto.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
    expect(Insumo.findByPk).not.toHaveBeenCalled();
  });

  it.each([
    ['POST', '/api/insumos', { nombre: 'Collarín', familia: 'Collarín', familia_abrev: 'COL' }, 201],
    ['PUT', '/api/insumos/1', { nombre: 'Collarín M' }, 200],
    ['DELETE', '/api/insumos/1', { motivo: 'prueba' }, 200],
    ['POST', '/api/insumos/1/reasignar', { ambulancia_nueva_id: null, tipo: 'permanente' }, 200],
    ['PUT', '/api/insumos/1/estado', { estado: 'activo' }, 200],
  ])('%s %s con rol admin pasa el control de acceso', async (metodo, url, body, esperado) => {
    vi.spyOn(ReasignacionAmbulancia, 'create').mockResolvedValue({ id: 3, toJSON: () => ({ id: 3 }) });

    const res = await enviar(metodo, url, tokenAdmin()).send(body);

    expect(res.status).toBe(esperado);
  });

  it.each([
    ['/api/insumos'],
    ['/api/insumos/bajas'],
    ['/api/insumos/qr/INS-COL-001'],
    ['/api/insumos/1'],
  ])('GET %s sigue permitido al rol ambulancia', async (url) => {
    const res = await enviar('GET', url, tokenAmbulancia());

    expect(res.status).toBe(200);
  });

  it('el endpoint legacy /movimiento responde 410 a cualquier rol', async () => {
    const res = await enviar('POST', '/api/insumos/1/movimiento', tokenAmbulancia()).send({});

    expect(res.status).toBe(410);
  });
});
