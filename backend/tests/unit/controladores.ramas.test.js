// Ramas que faltaban en los controladores: validaciones, valores por defecto y errores → next(error).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cjs, crearRes } from '../helpers.js';

const fs = cjs('fs');
const { Op } = cjs('sequelize');
const bcrypt = cjs('bcryptjs');
const {
  sequelize, Usuario, Role, Ambulancia, CentroAsistencial, MovimientoInsumo, ReporteInsumo,
  Insumo, BajaInsumo, ReasignacionAmbulancia, MovimientoInventario,
} = cjs('../src/models');
const centros = cjs('../src/controllers/centros.controller');
const ambulancias = cjs('../src/controllers/ambulancia.controller');
const usuarios = cjs('../src/controllers/usuario.controller');
const insumos = cjs('../src/controllers/insumo.controller');
const movimientos = cjs('../src/controllers/movimientos.controller');
const reportes = cjs('../src/controllers/reportes.controller');

let res;
let next;

beforeEach(() => {
  res = crearRes();
  next = vi.fn();
  vi.spyOn(fs, 'unlink').mockImplementation((_ruta, cb) => cb && cb(null));
});

// ─── centros.controller ──────────────────────────────────────────────────────
describe('centros.controller · listar', () => {
  it('con ?q= busca por nombre o municipio (ILIKE, sin espacios sobrantes)', async () => {
    const spy = vi.spyOn(CentroAsistencial, 'findAll').mockResolvedValue([{ id: 1 }]);

    await centros.listar({ query: { q: '  Bello ' } }, res, next);

    const { where, order } = spy.mock.calls[0][0];
    expect(where[Op.or]).toEqual([
      { nombre: { [Op.iLike]: '%Bello%' } },
      { municipio: { [Op.iLike]: '%Bello%' } },
    ]);
    expect(order).toEqual([['nombre', 'ASC']]);
    expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
  });

  it.each([[undefined], ['   ']])('con q=%j no filtra', async (q) => {
    const spy = vi.spyOn(CentroAsistencial, 'findAll').mockResolvedValue([]);

    await centros.listar({ query: { q } }, res, next);

    expect(spy.mock.calls[0][0].where).toEqual({});
  });
});

describe('centros.controller · crear', () => {
  it('normaliza todos los campos opcionales con trim', async () => {
    vi.spyOn(CentroAsistencial, 'findOne').mockResolvedValue(null);
    const spy = vi.spyOn(CentroAsistencial, 'create').mockResolvedValue({ id: 7 });

    await centros.crear({
      body: {
        nombre: ' Clínica ', municipio: ' Envigado ', direccion: ' Cra 1 ', telefono: ' 123 ', correo: ' a@b.co ',
      },
    }, res, next);

    expect(spy.mock.calls[0][0]).toMatchObject({
      nombre: 'Clínica', municipio: 'Envigado', direccion: 'Cra 1', telefono: '123', correo: 'a@b.co',
    });
    expect(spy.mock.calls[0][0].fechaRegistro).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.json).toHaveBeenCalledWith({ id: 7 });
  });

  it('400 si no se envía nombre', async () => {
    await centros.crear({ body: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El nombre es obligatorio.' });
  });
});

describe('centros.controller · editar', () => {
  const centroExistente = () => ({
    id: 3, nombre: 'Viejo', municipio: 'Itagüí', update: vi.fn().mockResolvedValue(undefined),
  });

  it.each([[{}], [{ nombre: '   ' }]])('400 si el nombre falta o está vacío (%j)', async (body) => {
    const centro = centroExistente();
    vi.spyOn(CentroAsistencial, 'findByPk').mockResolvedValue(centro);

    await centros.editar({ params: { id: '3' }, body }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El nombre es obligatorio.' });
    expect(centro.update).not.toHaveBeenCalled();
  });

  it('409 si otro centro (distinto id) ya usa ese nombre', async () => {
    const centro = centroExistente();
    vi.spyOn(CentroAsistencial, 'findByPk').mockResolvedValue(centro);
    const findOne = vi.spyOn(CentroAsistencial, 'findOne').mockResolvedValue({ id: 9 });

    await centros.editar({ params: { id: '3' }, body: { nombre: ' Hospital A ' } }, res, next);

    expect(findOne).toHaveBeenCalledWith({ where: { nombre: 'Hospital A', id: { [Op.ne]: 3 } } });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Ya existe un centro con ese nombre.' });
    expect(centro.update).not.toHaveBeenCalled();
  });

  it('éxito: conserva el municipio si no se envía y deja en null los opcionales vacíos', async () => {
    const centro = centroExistente();
    vi.spyOn(CentroAsistencial, 'findByPk').mockResolvedValue(centro);
    vi.spyOn(CentroAsistencial, 'findOne').mockResolvedValue(null);

    await centros.editar({
      params: { id: '3' },
      body: { nombre: ' Nuevo ', direccion: '  ', telefono: '', correo: undefined },
    }, res, next);

    expect(centro.update).toHaveBeenCalledWith({
      nombre: 'Nuevo', municipio: 'Itagüí', direccion: null, telefono: null, correo: null,
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(centro);
  });

  it('éxito: actualiza municipio y opcionales enviados', async () => {
    const centro = centroExistente();
    vi.spyOn(CentroAsistencial, 'findByPk').mockResolvedValue(centro);
    vi.spyOn(CentroAsistencial, 'findOne').mockResolvedValue(null);

    await centros.editar({
      params: { id: '3' },
      body: { nombre: 'Nuevo', municipio: ' Bello ', direccion: ' Calle 2 ', telefono: ' 555 ', correo: ' c@d.co ' },
    }, res, next);

    expect(centro.update).toHaveBeenCalledWith({
      nombre: 'Nuevo', municipio: 'Bello', direccion: 'Calle 2', telefono: '555', correo: 'c@d.co',
    });
  });
});

describe('centros.controller · 404 y errores', () => {
  it.each([
    ['toggleActivo', centros.toggleActivo],
    ['eliminar', centros.eliminar],
  ])('%s: 404 si el centro no existe', async (_n, handler) => {
    vi.spyOn(CentroAsistencial, 'findByPk').mockResolvedValue(null);

    await handler({ params: { id: '1' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Centro no encontrado.' });
  });

  it.each([
    ['listar', centros.listar, CentroAsistencial, 'findAll', { query: {} }],
    ['crear', centros.crear, CentroAsistencial, 'findOne', { body: { nombre: 'X' } }],
    ['editar', centros.editar, CentroAsistencial, 'findByPk', { params: { id: '1' }, body: {} }],
    ['toggleActivo', centros.toggleActivo, CentroAsistencial, 'findByPk', { params: { id: '1' } }],
    ['eliminar', centros.eliminar, CentroAsistencial, 'findByPk', { params: { id: '1' } }],
  ])('%s: delega en next(error) si falla la base', async (_n, handler, modelo, metodo, req) => {
    const error = new Error('fallo BD');
    vi.spyOn(modelo, metodo).mockRejectedValue(error);

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});

// ─── ambulancia.controller ───────────────────────────────────────────────────
describe('ambulancia.controller · ramas restantes', () => {
  it('listar con ?q= busca en código, placa y descripción', async () => {
    const spy = vi.spyOn(Ambulancia, 'findAll').mockResolvedValue([]);

    await ambulancias.listar({ query: { q: ' amb ', activa: 'cualquiera' } }, res, next);

    const { where } = spy.mock.calls[0][0];
    expect(where[Op.or]).toEqual([
      { codigo: { [Op.iLike]: '%amb%' } },
      { placa: { [Op.iLike]: '%amb%' } },
      { descripcion: { [Op.iLike]: '%amb%' } },
    ]);
    // un valor de activa distinto de "true"/"false" no filtra por estado
    expect(where).not.toHaveProperty('activa');
  });

  it('crear sin descripción la guarda como null y responde 201 con la nueva ambulancia', async () => {
    vi.spyOn(Ambulancia, 'findOne').mockResolvedValue(null);
    const spy = vi.spyOn(Ambulancia, 'create').mockResolvedValue({ id: 4 });

    await ambulancias.crear({ body: { codigo: 'AMB-04', placa: 'xyz789' } }, res, next);

    expect(spy.mock.calls[0][0].descripcion).toBeNull();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 4 });
  });

  it('editar: mismo código y placa (tras normalizar) no consulta duplicados', async () => {
    const amb = { codigo: 'AMB-01', placa: 'AAA111', descripcion: 'x', save: vi.fn() };
    vi.spyOn(Ambulancia, 'findByPk').mockResolvedValue(amb);
    const findOne = vi.spyOn(Ambulancia, 'findOne');

    await ambulancias.editar(
      { params: { id: '1' }, body: { codigo: ' AMB-01 ', placa: 'aaa111', descripcion: '' } },
      res,
      next,
    );

    expect(findOne).not.toHaveBeenCalled();
    expect(amb.descripcion).toBeNull();
    expect(amb.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(amb);
  });

  it('editar: cambia el código si está libre', async () => {
    const amb = { codigo: 'AMB-01', placa: 'AAA111', save: vi.fn() };
    vi.spyOn(Ambulancia, 'findByPk').mockResolvedValue(amb);
    vi.spyOn(Ambulancia, 'findOne').mockResolvedValue(null);

    await ambulancias.editar({ params: { id: '1' }, body: { codigo: ' AMB-07 ' } }, res, next);

    expect(amb.codigo).toBe('AMB-07');
    expect(amb.placa).toBe('AAA111');
  });

  it('editar: 409 si la nueva placa ya la usa otra ambulancia', async () => {
    const amb = { codigo: 'AMB-01', placa: 'AAA111', save: vi.fn() };
    vi.spyOn(Ambulancia, 'findByPk').mockResolvedValue(amb);
    const findOne = vi.spyOn(Ambulancia, 'findOne').mockResolvedValue({ id: 2 });

    await ambulancias.editar({ params: { id: '1' }, body: { placa: ' bbb222 ' } }, res, next);

    expect(findOne).toHaveBeenCalledWith({ where: { placa: 'BBB222' } });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Ya existe una ambulancia con esa placa' });
    expect(amb.save).not.toHaveBeenCalled();
  });

  it.each([
    ['toggleActiva', ambulancias.toggleActiva],
    ['eliminar', ambulancias.eliminar],
  ])('%s: 404 si no existe', async (_n, handler) => {
    vi.spyOn(Ambulancia, 'findByPk').mockResolvedValue(null);

    await handler({ params: { id: '1' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Ambulancia no encontrada' });
  });

  it('eliminar cuenta los movimientos de esa ambulancia', async () => {
    vi.spyOn(Ambulancia, 'findByPk').mockResolvedValue({ destroy: vi.fn() });
    const count = vi.spyOn(MovimientoInsumo, 'count').mockResolvedValue(0);

    await ambulancias.eliminar({ params: { id: '6' } }, res, next);

    expect(count).toHaveBeenCalledWith({ where: { ambulanciaId: '6' } });
  });

  it.each([
    ['listar', ambulancias.listar, 'findAll', { query: {} }],
    ['crear', ambulancias.crear, 'findOne', { body: { codigo: 'A', placa: 'B' } }],
    ['editar', ambulancias.editar, 'findByPk', { params: { id: '1' }, body: {} }],
    ['toggleActiva', ambulancias.toggleActiva, 'findByPk', { params: { id: '1' } }],
    ['eliminar', ambulancias.eliminar, 'findByPk', { params: { id: '1' } }],
  ])('%s: delega en next(error) si falla la base', async (_n, handler, metodo, req) => {
    const error = new Error('fallo BD');
    vi.spyOn(Ambulancia, metodo).mockRejectedValue(error);

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});

// ─── usuario.controller ──────────────────────────────────────────────────────
describe('usuario.controller · ramas restantes de editar', () => {
  const usuarioEditable = (extra = {}) => ({
    id: 3,
    nombre: 'Viejo',
    numero_ambulancia: 'Viejo01',
    roleId: 2,
    ambulanciaId: 4,
    activo: true,
    rol: { nombre: 'ambulancia' },
    save: vi.fn().mockResolvedValue(undefined),
    toJSON() {
      return { id: this.id, nombre: this.nombre, activo: this.activo, ambulanciaId: this.ambulanciaId, password: 'hash' };
    },
    ...extra,
  });

  it('actualiza nombre y estado activo, y nunca devuelve el password', async () => {
    const usuario = usuarioEditable();
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(usuario);

    await usuarios.editar({ params: { id: '3' }, body: { nombre: 'Nuevo', activo: false } }, res, next);

    expect(usuario.nombre).toBe('Nuevo');
    expect(usuario.activo).toBe(false);
    expect(usuario.ambulanciaId).toBe(4);
    expect(res.json).toHaveBeenCalledWith({ id: 3, nombre: 'Nuevo', activo: false, ambulanciaId: 4 });
  });

  it('un nombre vacío no sobrescribe el actual', async () => {
    const usuario = usuarioEditable();
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(usuario);

    await usuarios.editar({ params: { id: '3' }, body: { nombre: '' } }, res, next);

    expect(usuario.nombre).toBe('Viejo');
  });

  it('un admin al que se le envía ambulanciaId queda igualmente sin ambulancia', async () => {
    const usuario = usuarioEditable({ rol: { nombre: 'admin' } });
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(usuario);
    const findOne = vi.spyOn(Ambulancia, 'findOne');

    await usuarios.editar({ params: { id: '3' }, body: { ambulanciaId: 8 } }, res, next);

    expect(usuario.ambulanciaId).toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });

  it('un admin sin ambulanciaId en el cuerpo también queda sin ambulancia', async () => {
    const usuario = usuarioEditable({ rol: { nombre: 'admin' } });
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(usuario);

    await usuarios.editar({ params: { id: '3' }, body: {} }, res, next);

    expect(usuario.ambulanciaId).toBeNull();
  });

  it('ambulanciaId: null desasigna la ambulancia de un usuario de rol ambulancia', async () => {
    const usuario = usuarioEditable();
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(usuario);
    const findOne = vi.spyOn(Ambulancia, 'findOne');

    await usuarios.editar({ params: { id: '3' }, body: { ambulanciaId: null } }, res, next);

    expect(usuario.ambulanciaId).toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });

  it('al cambiar a rol ambulancia usa el rol nuevo para validar la ambulancia', async () => {
    const usuario = usuarioEditable({ roleId: 1, ambulanciaId: null, rol: { nombre: 'admin' } });
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(usuario);
    vi.spyOn(Role, 'findByPk').mockResolvedValue({ id: 2, nombre: 'ambulancia' });
    vi.spyOn(Ambulancia, 'findOne').mockResolvedValue({ id: 8 });

    await usuarios.editar({ params: { id: '3' }, body: { roleId: 2, ambulanciaId: 8 } }, res, next);

    expect(usuario.roleId).toBe(2);
    expect(usuario.ambulanciaId).toBe(8);
  });

  it('con un rol desconocido, ambulanciaId se ignora', async () => {
    const usuario = usuarioEditable({ rol: undefined });
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(usuario);

    await usuarios.editar({ params: { id: '3' }, body: { ambulanciaId: 8 } }, res, next);

    expect(usuario.ambulanciaId).toBe(4);
    expect(usuario.save).toHaveBeenCalledTimes(1);
  });

  it('cifra con bcrypt (12 rondas) la contraseña nueva', async () => {
    const usuario = usuarioEditable();
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(usuario);
    const hash = vi.spyOn(bcrypt, 'hash').mockResolvedValue('hash-nuevo');

    await usuarios.editar({ params: { id: '3' }, body: { password: 'Segura123!' } }, res, next);

    expect(hash).toHaveBeenCalledWith('Segura123!', 12);
    expect(usuario.password).toBe('hash-nuevo');
  });

  it.each([
    ['crear', usuarios.crear, 'findOne', { body: { nombre: 'A', numero_ambulancia: 'A1', password: 'Clave123*', roleId: 2 } }],
    ['editar', usuarios.editar, 'findByPk', { params: { id: '1' }, body: {} }],
    ['desactivar', usuarios.desactivar, 'findByPk', { params: { id: '1' } }],
  ])('%s: delega en next(error) si falla la base', async (_n, handler, metodo, req) => {
    const error = new Error('fallo BD');
    vi.spyOn(Usuario, metodo).mockRejectedValue(error);

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});

// ─── insumo.controller ───────────────────────────────────────────────────────
describe('insumo.controller · ramas restantes', () => {
  const FECHA = new Date(2026, 9, 5, 10, 0, 0);
  const insumoFalso = (extra = {}) => {
    const base = {
      id: 1, codigo: 'INS-COL-001', nombre: 'Collarín', familia: 'Collarín', especificaciones: null,
      estado: 'activo', ambulanciaId: 2, ambulancia: { id: 2, codigo: 'AMB-02' },
      createdAt: FECHA, updatedAt: FECHA, save: vi.fn().mockResolvedValue(undefined), ...extra,
    };
    base.toJSON = () => {
      const { save, toJSON, ...datos } = base;
      return datos;
    };
    return base;
  };
  const foto = { filename: 'foto.jpg' };

  it('formatea fechas inválidas o ausentes como null', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumoFalso({ createdAt: 'no-es-fecha', updatedAt: null }));

    await insumos.obtener({ params: { id: '1' } }, res, next);

    expect(res.json.mock.calls[0][0]).toMatchObject({ fecha_creacion: null, fecha_modificacion: null });
  });

  it('formatea objetos planos (sin toJSON)', async () => {
    vi.spyOn(Insumo, 'findAll').mockResolvedValue([{ id: 5, codigo: 'INS-X-001', createdAt: FECHA }]);

    await insumos.listar({ query: {} }, res, next);

    expect(res.json).toHaveBeenCalledWith([
      { id: 5, codigo: 'INS-X-001', createdAt: FECHA, fecha_creacion: '05-10-2026', fecha_modificacion: null },
    ]);
  });

  it('crear: si el contador aún no tiene fila empieza en 001', async () => {
    const t = { commit: vi.fn(), rollback: vi.fn() };
    vi.spyOn(sequelize, 'transaction').mockResolvedValue(t);
    vi.spyOn(sequelize, 'query').mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
    const create = vi.spyOn(Insumo, 'create').mockImplementation(async (datos) => ({ ...datos }));

    await insumos.crear({ body: { nombre: 'Férula', familia: 'Férulas', familia_abrev: 'fer' } }, res, next);

    expect(create.mock.calls[0][0]).toMatchObject({
      codigo: 'INS-FER-001', codigo_qr: 'INS-FER-001', especificaciones: null, ambulanciaId: null,
    });
    expect(sequelize.query.mock.calls[1][1].replacements).toEqual({ val: 1 });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('editar: limpia especificaciones y observaciones vacías a null', async () => {
    const insumo = insumoFalso({ especificaciones: 'algo', observaciones: 'algo' });
    vi.spyOn(Insumo, 'findByPk').mockResolvedValueOnce(insumo).mockResolvedValueOnce(insumo);

    await insumos.editar({ params: { id: '1' }, body: { especificaciones: '  ', observaciones: '' } }, res, next);

    expect(insumo.especificaciones).toBeNull();
    expect(insumo.observaciones).toBeNull();
    expect(insumo.save).toHaveBeenCalledTimes(1);
  });

  it('editar: guarda observaciones con trim', async () => {
    const insumo = insumoFalso();
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumo);

    await insumos.editar({ params: { id: '1' }, body: { observaciones: ' Revisar ' } }, res, next);

    expect(insumo.observaciones).toBe('Revisar');
  });

  it('darDeBaja: sin motivo y sin foto no intenta borrar archivos', async () => {
    await insumos.darDeBaja({ params: { id: '1' }, body: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El motivo de baja es requerido' });
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('darDeBaja: usa ID-<id> y "—" cuando el insumo no tiene código ni familia', async () => {
    const insumo = insumoFalso({ codigo: null, familia: null, especificaciones: 'Talla M', ambulancia: null });
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumo);
    const create = vi.spyOn(BajaInsumo, 'create').mockResolvedValue({ toJSON: () => ({ id: 2 }), fecha_baja: null });

    await insumos.darDeBaja({ params: { id: '1' }, body: { motivo: 'Roto' }, file: foto }, res, next);

    expect(create.mock.calls[0][0]).toMatchObject({
      codigo: 'ID-1', familia: '—', especificaciones: 'Talla M', ambulancia_codigo: null,
    });
    expect(res.json.mock.calls[0][0].baja).toEqual({ id: 2, fecha_baja_fmt: null });
  });

  it.each([[123], [['a', 'b']], [{ texto: 'x' }]])('darDeBaja: un motivo que no es texto (%j) responde 400 y borra la foto', async (motivo) => {
    await insumos.darDeBaja({ params: { id: '1' }, body: { motivo }, file: { filename: 'f.png' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El motivo de baja es requerido' });
    expect(next).not.toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalledTimes(1);
  });

  it('darDeBaja: un motivo que no es texto y sin foto responde 400 sin borrar nada', async () => {
    await insumos.darDeBaja({ params: { id: '1' }, body: { motivo: 123 } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('reasignar: usa ID-<id> y el id del usuario si no hay código ni número de ambulancia', async () => {
    const insumo = insumoFalso({ codigo: null, ambulanciaId: null, ambulancia: null });
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumo);
    const create = vi.spyOn(ReasignacionAmbulancia, 'create').mockResolvedValue({
      toJSON: () => ({ id: 3 }), fecha_reasignacion: FECHA,
    });

    await insumos.reasignar(
      { params: { id: '1' }, body: { tipo: 'prestamo', fecha_devolucion_esperada: '2026-11-01' }, usuario: { id: 9 } },
      res,
      next,
    );

    expect(create.mock.calls[0][0]).toMatchObject({
      codigo_insumo: 'ID-1',
      ambulancia_anterior_id: null,
      ambulancia_anterior_codigo: null,
      ambulancia_nueva_id: null,
      tipo: 'prestamo',
      notas: null,
      fecha_devolucion_esperada: '2026-11-01',
      usuario_responsable: '9',
    });
  });

  it('reasignar: sin usuario en la petición deja usuario_responsable vacío', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumoFalso());
    const create = vi.spyOn(ReasignacionAmbulancia, 'create').mockResolvedValue({ toJSON: () => ({}) });

    await insumos.reasignar({ params: { id: '1' }, body: {} }, res, next);

    expect(create.mock.calls[0][0].usuario_responsable).toBe('');
  });

  it('eliminarLogico: usa el motivo enviado y ID-<id>/"—" como respaldo', async () => {
    const insumo = insumoFalso({ codigo: null, familia: null, especificaciones: 'Talla S' });
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumo);
    const create = vi.spyOn(BajaInsumo, 'create').mockResolvedValue({ id: 4 });

    await insumos.eliminarLogico({ params: { id: '1' }, body: { motivo: ' Extraviado ' } }, res, next);

    expect(create.mock.calls[0][0]).toMatchObject({
      codigo: 'ID-1', familia: '—', especificaciones: 'Talla S', motivo: 'Extraviado', foto_ruta: null,
    });
    expect(insumo.estado).toBe('dado_de_baja');
    expect(res.json).toHaveBeenCalledWith({ message: 'Insumo dado de baja correctamente', id: 1 });
  });

  it('cambiarEstado sin motivo no toca las observaciones', async () => {
    const insumo = insumoFalso({ estado: 'dado_de_baja', observaciones: 'previa' });
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumo);

    await insumos.cambiarEstado({ params: { id: '1' }, body: { estado: 'activo' } }, res, next);

    expect(insumo.estado).toBe('activo');
    expect(insumo.observaciones).toBe('previa');
  });

  it.each([
    ['listarBajas', 'listarBajas', BajaInsumo, 'findAll', {}],
    ['obtener', 'obtener', Insumo, 'findByPk', { params: { id: '1' } }],
    ['buscar', 'buscar', sequelize, 'query', { query: { q: 'collarín' } }],
    ['buscarPorQR', 'buscarPorQR', Insumo, 'findOne', { params: { codigo: 'x' } }],
    ['editar', 'editar', Insumo, 'findByPk', { params: { id: '1' }, body: {} }],
    ['reasignar', 'reasignar', Insumo, 'findByPk', { params: { id: '1' }, body: {} }],
    ['generarQR', 'generarQR', Insumo, 'findByPk', { params: { id: '1' } }],
    ['historialReasignaciones', 'historialReasignaciones', Insumo, 'findByPk', { params: { id: '1' } }],
    ['eliminarLogico', 'eliminarLogico', Insumo, 'findByPk', { params: { id: '1' }, body: {} }],
    ['cambiarEstado', 'cambiarEstado', Insumo, 'findByPk', { params: { id: '1' }, body: { estado: 'activo' } }],
    ['historial', 'historial', Insumo, 'findByPk', { params: { id: '1' } }],
  ])('%s: delega en next(error) si falla la base', async (_n, handler, modelo, metodo, req) => {
    const error = new Error('fallo BD');
    vi.spyOn(modelo, metodo).mockRejectedValue(error);

    await insumos[handler](req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('historial: consulta los movimientos legacy de ese insumo, del más reciente al más antiguo', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumoFalso());
    const spy = vi.spyOn(MovimientoInventario, 'findAll').mockResolvedValue([]);

    await insumos.historial({ params: { id: '1' } }, res, next);

    expect(spy).toHaveBeenCalledWith({ where: { id_insumo: '1' }, order: [['fecha', 'DESC']] });
  });
});

// ─── movimientos.controller y reportes.controller ────────────────────────────
describe('movimientos.controller · ramas restantes', () => {
  const usuarioReq = { id: 4, rol: 'ambulancia' };

  it.each([
    ['crearEntrega', movimientos.crearEntrega, 'Entrega registrada exitosamente'],
    ['crearRecogida', movimientos.crearRecogida, 'Recogida registrada exitosamente'],
  ])('%s: usa el código enviado si el insumo (legacy) no tiene código', async (_n, handler, mensaje) => {
    vi.spyOn(Insumo, 'findOne').mockResolvedValue({ id: 11, codigo: null });
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(null);
    const create = vi.spyOn(MovimientoInsumo, 'create').mockResolvedValue({ id: 1 });

    await handler({ body: { codigoInsumo: 'uuid-legacy' }, usuario: usuarioReq }, res, next);

    expect(create.mock.calls[0][0]).toMatchObject({
      codigoInsumo: 'uuid-legacy',
      nombrePaciente: null,
      centroAsistencialId: null,
      ambulanciaId: null,
      usuarioId: 4,
    });
    expect(res.json).toHaveBeenCalledWith({ message: mensaje, movimiento: { id: 1 } });
  });

  it('crearDanoPerdida: usa el código enviado si el insumo no tiene código', async () => {
    vi.spyOn(Insumo, 'findOne').mockResolvedValue({ id: 11, codigo: null });
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue({ id: 4, ambulanciaId: 6 });
    const create = vi.spyOn(ReporteInsumo, 'create').mockResolvedValue({ id: 2 });

    await movimientos.crearDanoPerdida(
      { body: { tipo: 'dano', codigoInsumo: 'uuid-legacy', motivo: 'Roto' }, usuario: usuarioReq },
      res,
      next,
    );

    expect(create.mock.calls[0][0]).toMatchObject({
      codigoInsumo: 'uuid-legacy', ambulanciaId: 6, fotosRutas: [],
    });
  });

  it.each([
    ['getCentros', movimientos.getCentros, CentroAsistencial, 'findAll', {}],
    ['crearEntrega', movimientos.crearEntrega, Insumo, 'findOne', { body: { codigoInsumo: 'x' }, usuario: usuarioReq }],
    ['getHistorial', movimientos.getHistorial, Usuario, 'findByPk', { query: {}, usuario: usuarioReq }],
    ['ultimoPorInsumo', movimientos.ultimoPorInsumo, Insumo, 'findOne', { query: { codigo: 'x' }, usuario: usuarioReq }],
    ['crearRecogida', movimientos.crearRecogida, Insumo, 'findOne', { body: { codigoInsumo: 'x' }, usuario: usuarioReq }],
    ['crearDanoPerdida', movimientos.crearDanoPerdida, Insumo, 'findOne',
      { body: { tipo: 'dano', codigoInsumo: 'x', motivo: 'y' }, usuario: usuarioReq }],
  ])('%s: delega en next(error) si falla la base', async (_n, handler, modelo, metodo, req) => {
    const error = new Error('fallo BD');
    vi.spyOn(modelo, metodo).mockRejectedValue(error);

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });

  const fotos = () => [{ filename: 'a.jpg' }, { filename: 'b.png', path: '/tmp/subidas/b.png' }];

  it.each([
    ['tipo inválido', { tipo: 'robo', codigoInsumo: 'x', motivo: 'y' }, 400],
    ['sin código', { tipo: 'dano', motivo: 'y' }, 400],
    ['motivo vacío', { tipo: 'dano', codigoInsumo: 'x', motivo: '  ' }, 400],
  ])('crearDanoPerdida: con %s responde el error y borra las fotos ya subidas', async (_c, body, status) => {
    await movimientos.crearDanoPerdida({ body, files: fotos(), usuario: usuarioReq }, res, next);

    expect(res.status).toHaveBeenCalledWith(status);
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(fs.unlink.mock.calls[0][0]).toMatch(/uploads[\\/]evidencias[\\/]a\.jpg$/);
    expect(fs.unlink.mock.calls[1][0]).toBe('/tmp/subidas/b.png');
  });

  it('crearDanoPerdida: si el insumo no existe responde 404 y borra las fotos', async () => {
    vi.spyOn(Insumo, 'findOne').mockResolvedValue(null);

    await movimientos.crearDanoPerdida(
      { body: { tipo: 'dano', codigoInsumo: 'x', motivo: 'y' }, files: fotos(), usuario: usuarioReq }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(fs.unlink).toHaveBeenCalledTimes(2);
  });

  it('crearDanoPerdida: si la base falla borra las fotos y pasa el error original a next', async () => {
    const error = new Error('fallo BD');
    vi.spyOn(Insumo, 'findOne').mockRejectedValue(error);
    // Un fallo al borrar se registra, pero no reemplaza el error original
    fs.unlink.mockImplementation((_r, cb) => cb(new Error('EBUSY')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await movimientos.crearDanoPerdida(
      { body: { tipo: 'dano', codigoInsumo: 'x', motivo: 'y' }, files: fotos(), usuario: usuarioReq }, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(fs.unlink).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith('[evidencias] No se pudo borrar', 'a.jpg', 'EBUSY');
  });

  it('crearDanoPerdida: un reporte exitoso conserva las fotos', async () => {
    vi.spyOn(Insumo, 'findOne').mockResolvedValue({ id: 11, codigo: 'INS-1' });
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue({ id: 4, ambulanciaId: 6 });
    vi.spyOn(ReporteInsumo, 'create').mockResolvedValue({ id: 2 });

    await movimientos.crearDanoPerdida(
      { body: { tipo: 'dano', codigoInsumo: 'x', motivo: 'y' }, files: fotos(), usuario: usuarioReq }, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('crearDanoPerdida: sin fotos no intenta borrar nada', async () => {
    await movimientos.crearDanoPerdida({ body: { tipo: 'robo' }, usuario: usuarioReq }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fs.unlink).not.toHaveBeenCalled();
  });
});

describe('reportes.controller · errores', () => {
  it.each([
    ['getAdminHistorial', reportes.getAdminHistorial, { query: {} }],
    ['getAdminPendientes', reportes.getAdminPendientes, { query: {} }],
  ])('%s: delega en next(error) si falla la consulta', async (_n, handler, req) => {
    const error = new Error('fallo SQL');
    vi.spyOn(sequelize, 'query').mockRejectedValue(error);

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
