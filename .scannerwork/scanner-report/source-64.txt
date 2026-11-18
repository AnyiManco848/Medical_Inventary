import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cjs, crearRes } from '../helpers.js';

const fs = cjs('fs');
const {
  sequelize, Insumo, Ambulancia, BajaInsumo, ReasignacionAmbulancia, MovimientoInventario,
} = cjs('../src/models');
const ctrl = cjs('../src/controllers/insumo.controller');

// Fecha fija (hora local) para comprobar el formato DD-MM-AAAA
const FECHA = new Date(2026, 9, 5, 10, 0, 0);

function insumoFalso(extra = {}) {
  const base = {
    id: 1,
    codigo: 'INS-COL-001',
    nombre: 'Collarín cervical adulto',
    familia: 'Collarín cervical',
    especificaciones: null,
    estado: 'activo',
    ambulanciaId: 2,
    ambulancia: { id: 2, codigo: 'AMB-02' },
    createdAt: FECHA,
    updatedAt: FECHA,
    save: vi.fn().mockResolvedValue(undefined),
    ...extra,
  };
  base.toJSON = () => {
    const { save, toJSON, ...datos } = base;
    return datos;
  };
  return base;
}

let res;
let next;

beforeEach(() => {
  res = crearRes();
  next = vi.fn();
  vi.spyOn(fs, 'unlink').mockImplementation((_ruta, cb) => cb && cb(null));
});

describe('insumo.controller · listar / obtener / listarBajas', () => {
  it('listar: solo insumos activos, ordenados por código, con fechas DD-MM-AAAA', async () => {
    const spy = vi.spyOn(Insumo, 'findAll').mockResolvedValue([insumoFalso()]);

    await ctrl.listar({ query: {} }, res, next);

    const opciones = spy.mock.calls[0][0];
    expect(opciones.where).toEqual({ estado: 'activo' });
    expect(opciones.order).toEqual([['codigo', 'ASC']]);
    const [item] = res.json.mock.calls[0][0];
    expect(item.fecha_creacion).toBe('05-10-2026');
    expect(item.fecha_modificacion).toBe('05-10-2026');
  });

  it('listar: aplica los filtros de ambulancia y familia', async () => {
    const spy = vi.spyOn(Insumo, 'findAll').mockResolvedValue([]);

    await ctrl.listar({ query: { ambulanciaId: '4', familia: 'Venda' } }, res, next);

    expect(spy.mock.calls[0][0].where).toEqual({ estado: 'activo', ambulanciaId: '4', familia: 'Venda' });
  });

  it('listar: delega en next(error) si falla', async () => {
    const error = new Error('fallo');
    vi.spyOn(Insumo, 'findAll').mockRejectedValue(error);

    await ctrl.listar({ query: {} }, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('obtener: 404 si no existe', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(null);

    await ctrl.obtener({ params: { id: '9' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Insumo no encontrado' });
  });

  it('obtener: devuelve el insumo formateado', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumoFalso());

    await ctrl.obtener({ params: { id: '1' } }, res, next);

    expect(res.json.mock.calls[0][0]).toMatchObject({ codigo: 'INS-COL-001', fecha_creacion: '05-10-2026' });
  });

  it('listarBajas: formatea la fecha de baja', async () => {
    vi.spyOn(BajaInsumo, 'findAll').mockResolvedValue([
      { toJSON: () => ({ id: 1, codigo: 'INS-COL-001' }), fecha_baja: FECHA },
    ]);

    await ctrl.listarBajas({}, res, next);

    expect(res.json.mock.calls[0][0]).toEqual([
      { id: 1, codigo: 'INS-COL-001', fecha_baja_fmt: '05-10-2026' },
    ]);
  });
});

describe('insumo.controller · buscar', () => {
  it('por código exacto (en mayúsculas)', async () => {
    const spy = vi.spyOn(Insumo, 'findOne').mockResolvedValue(insumoFalso());

    await ctrl.buscar({ query: { codigo: 'ins-col-001' } }, res, next);

    expect(spy.mock.calls[0][0].where).toEqual({ codigo: 'INS-COL-001' });
    expect(res.json).toHaveBeenCalled();
  });

  it('por código: 404 si no existe', async () => {
    vi.spyOn(Insumo, 'findOne').mockResolvedValue(null);

    await ctrl.buscar({ query: { codigo: 'X' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it.each([[undefined], [''], ['a'], [' b ']])('texto %j demasiado corto → lista vacía sin consultar la BD', async (q) => {
    const spy = vi.spyOn(sequelize, 'query');

    await ctrl.buscar({ query: { q } }, res, next);

    expect(res.json).toHaveBeenCalledWith([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('por texto: usa parámetro %término% (sin concatenar) y transforma las filas', async () => {
    const spy = vi.spyOn(sequelize, 'query').mockResolvedValue([
      { id: 1, codigo: 'INS-COL-001', nombre: 'Collarín', familia: 'Collarín cervical',
        especificaciones: null, ambulanciaId: 2, estado: 'activo', ambulanciaCodigo: 'AMB-02' },
      { id: 2, codigo: 'INS-COL-002', nombre: 'Collarín', familia: 'Collarín cervical',
        especificaciones: null, ambulanciaId: null, estado: 'activo', ambulanciaCodigo: null },
    ]);

    await ctrl.buscar({ query: { q: " collarin'; DROP TABLE x;-- " } }, res, next);

    const [sql, opciones] = spy.mock.calls[0];
    expect(opciones.replacements.term).toBe("%collarin'; DROP TABLE x;--%");
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).toContain('LIMIT 30');
    const [a, b] = res.json.mock.calls[0][0];
    expect(a.ambulancia).toEqual({ codigo: 'AMB-02' });
    expect(b.ambulancia).toBeNull();
  });
});

describe('insumo.controller · buscarPorQR', () => {
  it('encuentra por código INS', async () => {
    const spy = vi.spyOn(Insumo, 'findOne').mockResolvedValue(insumoFalso());

    await ctrl.buscarPorQR({ params: { codigo: 'ins-col-001' } }, res, next);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].where).toEqual({ codigo: 'INS-COL-001' });
  });

  it('si no, reintenta con el UUID legacy del QR', async () => {
    const spy = vi.spyOn(Insumo, 'findOne')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(insumoFalso());

    await ctrl.buscarPorQR({ params: { codigo: 'uuid-legacy' } }, res, next);

    expect(spy.mock.calls[1][0].where).toEqual({ codigo_qr: 'uuid-legacy' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('404 si no existe por ninguna vía', async () => {
    vi.spyOn(Insumo, 'findOne').mockResolvedValue(null);

    await ctrl.buscarPorQR({ params: { codigo: 'nada' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'No se encontró ningún insumo con ese código QR',
    });
  });
});

describe('insumo.controller · crear', () => {
  const cuerpo = { nombre: ' Pinza ', familia: ' Pinza Rochester ', familia_abrev: 'roc', cantidad: 3 };

  // Simula el contador de códigos de la tabla ContadorCodigo
  function simularContador(inicial = 13) {
    let valor = inicial;
    const sqls = [];
    vi.spyOn(sequelize, 'query').mockImplementation(async (sql, opciones) => {
      sqls.push(sql);
      if (/SELECT/i.test(sql)) return [[{ valor }]];
      if (/UPDATE/i.test(sql)) { valor = opciones.replacements.val; return [[], 1]; }
      return [[]];
    });
    return sqls;
  }

  function simularTransaccion() {
    const t = { commit: vi.fn().mockResolvedValue(undefined), rollback: vi.fn().mockResolvedValue(undefined) };
    vi.spyOn(sequelize, 'transaction').mockResolvedValue(t);
    return t;
  }

  it.each([
    ['nombre', { nombre: '  ' }, 'El nombre del insumo es requerido'],
    ['familia', { familia: '' }, 'La familia del insumo es requerida'],
    ['abreviatura', { familia_abrev: undefined }, 'La abreviatura de la familia es requerida'],
  ])('400 si falta %s', async (_c, cambio, mensaje) => {
    await ctrl.crear({ body: { ...cuerpo, ...cambio } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: mensaje });
  });

  it.each([[0], [51], ['abc'], [-3]])('400 si la cantidad es %j (debe estar entre 1 y 50)', async (cantidad) => {
    await ctrl.crear({ body: { ...cuerpo, cantidad } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'La cantidad debe ser un número entre 1 y 50' });
  });

  it('201: crea una unidad por cantidad con códigos INS-FAM-### consecutivos', async () => {
    simularContador(13);
    const t = simularTransaccion();
    const spy = vi.spyOn(Insumo, 'create').mockImplementation(async (datos) => ({
      toJSON: () => ({ id: 1, ...datos, createdAt: FECHA, updatedAt: FECHA }),
    }));

    await ctrl.crear({ body: { ...cuerpo, ambulanciaId: '4' } }, res, next);

    expect(spy).toHaveBeenCalledTimes(3);
    const codigos = spy.mock.calls.map((c) => c[0].codigo);
    expect(codigos).toEqual(['INS-ROC-014', 'INS-ROC-015', 'INS-ROC-016']);
    expect(spy.mock.calls[0][0]).toMatchObject({
      nombre: 'Pinza',
      familia: 'Pinza Rochester',
      familia_abrev: 'ROC',
      estado: 'activo',
      ambulanciaId: 4,
      codigo_qr: 'INS-ROC-014',
    });
    expect(t.commit).toHaveBeenCalledTimes(1);
    expect(t.rollback).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].total).toBe(3);
  });

  it('recorta la abreviatura a 5 letras en mayúsculas', async () => {
    simularContador(0);
    simularTransaccion();
    const spy = vi.spyOn(Insumo, 'create').mockImplementation(async (d) => ({
      toJSON: () => ({ ...d, createdAt: FECHA, updatedAt: FECHA }),
    }));

    await ctrl.crear({ body: { ...cuerpo, cantidad: 1, familia_abrev: 'collarin' } }, res, next);

    expect(spy.mock.calls[0][0].codigo).toBe('INS-COLLA-001');
    expect(spy.mock.calls[0][0].familia_abrev).toBe('COLLA');
  });

  it('hace rollback y delega en next(error) si falla la creación', async () => {
    simularContador(0);
    const t = simularTransaccion();
    const error = new Error('violación de unicidad');
    vi.spyOn(Insumo, 'create').mockRejectedValue(error);

    await ctrl.crear({ body: { ...cuerpo, cantidad: 2 } }, res, next);

    expect(t.rollback).toHaveBeenCalledTimes(1);
    expect(t.commit).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalledWith(201);
  });

  // Regresión: el contador usaba sintaxis de SQL Server ([valor], WITH (UPDLOCK)),
  // que PostgreSQL rechaza ("syntax error at or near '['") y hacía que
  // POST /api/insumos respondiera 500 contra una base real.
  it('el SQL del contador es compatible con PostgreSQL', async () => {
    const sqls = simularContador(0);
    simularTransaccion();
    vi.spyOn(Insumo, 'create').mockImplementation(async (d) => ({
      toJSON: () => ({ ...d, createdAt: FECHA, updatedAt: FECHA }),
    }));

    await ctrl.crear({ body: { ...cuerpo, cantidad: 1 } }, res, next);

    for (const sql of sqls) {
      expect(sql).not.toMatch(/\[valor\]|\[ContadorCodigo\]|UPDLOCK/);
    }
  });
});

describe('insumo.controller · editar', () => {
  it('404 si no existe', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(null);

    await ctrl.editar({ params: { id: '1' }, body: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('400 si el insumo está dado de baja', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumoFalso({ estado: 'dado_de_baja' }));

    await ctrl.editar({ params: { id: '1' }, body: { nombre: 'X' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'No se puede editar un insumo dado de baja' });
  });

  it('400 si el nombre queda vacío', async () => {
    const insumo = insumoFalso();
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumo);

    await ctrl.editar({ params: { id: '1' }, body: { nombre: '   ' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(insumo.save).not.toHaveBeenCalled();
  });

  it('actualiza solo los campos enviados, normaliza vacíos a null y devuelve el registro recargado', async () => {
    const insumo = insumoFalso({ especificaciones: 'Talla M', observaciones: 'x' });
    const buscar = vi.spyOn(Insumo, 'findByPk')
      .mockResolvedValueOnce(insumo)
      .mockResolvedValueOnce(insumoFalso({ nombre: 'Nuevo nombre' }));

    await ctrl.editar(
      { params: { id: '1' }, body: { nombre: ' Nuevo nombre ', especificaciones: '  ', ambulanciaId: '7' } },
      res,
      next,
    );

    expect(insumo.nombre).toBe('Nuevo nombre');
    expect(insumo.especificaciones).toBeNull();
    expect(insumo.ambulanciaId).toBe(7);
    expect(insumo.observaciones).toBe('x'); // no se envió → no cambia
    expect(insumo.save).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledTimes(2);
    expect(res.json.mock.calls[0][0].nombre).toBe('Nuevo nombre');
  });

  it('ambulanciaId vacío desasigna el insumo', async () => {
    const insumo = insumoFalso();
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumo);

    await ctrl.editar({ params: { id: '1' }, body: { ambulanciaId: null } }, res, next);

    expect(insumo.ambulanciaId).toBeNull();
  });
});

describe('insumo.controller · darDeBaja', () => {
  const archivo = { filename: 'foto.jpg' };

  it('400 sin motivo y borra la foto ya subida', async () => {
    await ctrl.darDeBaja({ params: { id: '1' }, body: { motivo: '  ' }, file: archivo }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El motivo de baja es requerido' });
    expect(fs.unlink).toHaveBeenCalledTimes(1);
  });

  it('400 sin foto de evidencia', async () => {
    await ctrl.darDeBaja({ params: { id: '1' }, body: { motivo: 'Vencido' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'La foto de evidencia es requerida para dar de baja',
    });
  });

  it('404 si el insumo no existe y borra la foto', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(null);

    await ctrl.darDeBaja({ params: { id: '1' }, body: { motivo: 'Vencido' }, file: archivo }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(fs.unlink).toHaveBeenCalledTimes(1);
  });

  it('400 si ya estaba dado de baja y borra la foto', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumoFalso({ estado: 'dado_de_baja' }));

    await ctrl.darDeBaja({ params: { id: '1' }, body: { motivo: 'Vencido' }, file: archivo }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El insumo ya está dado de baja' });
    expect(fs.unlink).toHaveBeenCalledTimes(1);
  });

  it('registra la baja, libera la ambulancia y cambia el estado', async () => {
    const insumo = insumoFalso();
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumo);
    const crear = vi.spyOn(BajaInsumo, 'create').mockResolvedValue({
      toJSON: () => ({ id: 5 }),
      fecha_baja: FECHA,
    });

    await ctrl.darDeBaja({ params: { id: '1' }, body: { motivo: ' Vencido ' }, file: archivo }, res, next);

    expect(crear.mock.calls[0][0]).toMatchObject({
      insumoId: 1,
      codigo: 'INS-COL-001',
      ambulancia_codigo: 'AMB-02',
      motivo: 'Vencido',
      foto_ruta: '/uploads/insumos/foto.jpg',
    });
    expect(insumo.estado).toBe('dado_de_baja');
    expect(insumo.ambulanciaId).toBeNull();
    expect(insumo.save).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].baja).toEqual({ id: 5, fecha_baja_fmt: '05-10-2026' });
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('si algo falla, borra la foto subida y delega en next(error)', async () => {
    const error = new Error('fallo BD');
    vi.spyOn(Insumo, 'findByPk').mockRejectedValue(error);

    await ctrl.darDeBaja({ params: { id: '1' }, body: { motivo: 'Vencido' }, file: archivo }, res, next);

    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('insumo.controller · reasignar', () => {
  const reasignacionCreada = () => ({
    toJSON: () => ({ id: 1 }),
    fecha_reasignacion: FECHA,
  });

  it('404 si el insumo no existe', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(null);

    await ctrl.reasignar({ params: { id: '1' }, body: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('400 si el insumo está dado de baja', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumoFalso({ estado: 'dado_de_baja' }));

    await ctrl.reasignar({ params: { id: '1' }, body: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'No se puede reasignar un insumo dado de baja' });
  });

  it('400 si el tipo no es permanente ni prestamo', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumoFalso());

    await ctrl.reasignar({ params: { id: '1' }, body: { tipo: 'regalo' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Tipo debe ser "permanente" o "prestamo"' });
  });

  it('404 si la ambulancia de destino no existe', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumoFalso());
    vi.spyOn(Ambulancia, 'findByPk').mockResolvedValue(null);

    await ctrl.reasignar({ params: { id: '1' }, body: { ambulancia_nueva_id: 99 } }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Ambulancia de destino no encontrada' });
  });

  it('reasigna de forma permanente, guarda el historial y actualiza el insumo', async () => {
    const insumo = insumoFalso();
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumo);
    vi.spyOn(Ambulancia, 'findByPk').mockResolvedValue({ id: 8, codigo: 'AMB-08' });
    const crear = vi.spyOn(ReasignacionAmbulancia, 'create').mockResolvedValue(reasignacionCreada());

    await ctrl.reasignar(
      {
        params: { id: '1' },
        body: { ambulancia_nueva_id: '8', notas: ' Por mantenimiento ' },
        usuario: { id: 1, numero_ambulancia: 'Administrador01' },
      },
      res,
      next,
    );

    expect(crear.mock.calls[0][0]).toMatchObject({
      insumoId: 1,
      codigo_insumo: 'INS-COL-001',
      ambulancia_anterior_id: 2,
      ambulancia_anterior_codigo: 'AMB-02',
      ambulancia_nueva_id: 8,
      ambulancia_nueva_codigo: 'AMB-08',
      tipo: 'permanente',
      notas: 'Por mantenimiento',
      usuario_responsable: 'Administrador01',
    });
    expect(insumo.ambulanciaId).toBe(8);
    expect(insumo.save).toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].reasignacion.fecha_reasignacion_fmt).toBe('05-10-2026');
  });

  it('sin ambulancia de destino deja el insumo sin asignar (bodega)', async () => {
    const insumo = insumoFalso();
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumo);
    const crear = vi.spyOn(ReasignacionAmbulancia, 'create').mockResolvedValue(reasignacionCreada());

    await ctrl.reasignar({ params: { id: '1' }, body: { tipo: 'prestamo' }, usuario: { id: 3 } }, res, next);

    expect(crear.mock.calls[0][0]).toMatchObject({
      ambulancia_nueva_id: null,
      ambulancia_nueva_codigo: null,
      tipo: 'prestamo',
      usuario_responsable: '3',
    });
    expect(insumo.ambulanciaId).toBeNull();
  });
});

describe('insumo.controller · generarQR', () => {
  function resConCabeceras() {
    const r = crearRes();
    r.setHeader = vi.fn();
    r.send = vi.fn();
    return r;
  }

  it('404 si no existe', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(null);

    await ctrl.generarQR({ params: { id: '1' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('400 si el insumo no tiene código ni código QR', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumoFalso({ codigo: null, codigo_qr: null }));

    await ctrl.generarQR({ params: { id: '1' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Este insumo no tiene código asignado' });
  });

  it('devuelve una imagen PNG válida', async () => {
    const r = resConCabeceras();
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumoFalso());

    await ctrl.generarQR({ params: { id: '1' } }, r, next);

    expect(r.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(r.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'inline; filename="qr-INS-COL-001.png"',
    );
    const png = r.send.mock.calls[0][0];
    expect(Buffer.isBuffer(png)).toBe(true);
    // Firma de un archivo PNG
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });
});

describe('insumo.controller · historial de reasignaciones y endpoints legacy', () => {
  it('historialReasignaciones: 404 si el insumo no existe', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(null);

    await ctrl.historialReasignaciones({ params: { id: '1' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('historialReasignaciones: devuelve el historial con fechas formateadas', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumoFalso());
    vi.spyOn(ReasignacionAmbulancia, 'findAll').mockResolvedValue([
      { toJSON: () => ({ id: 1 }), fecha_reasignacion: FECHA, fecha_devolucion_esperada: null },
    ]);

    await ctrl.historialReasignaciones({ params: { id: '1' } }, res, next);

    expect(res.json.mock.calls[0][0]).toEqual([
      { id: 1, fecha_reasignacion_fmt: '05-10-2026', fecha_devolucion_fmt: null },
    ]);
  });

  it('eliminarLogico: da de baja sin foto con motivo por defecto', async () => {
    const insumo = insumoFalso();
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumo);
    const crear = vi.spyOn(BajaInsumo, 'create').mockResolvedValue({});

    await ctrl.eliminarLogico({ params: { id: '1' }, body: {} }, res, next);

    expect(crear.mock.calls[0][0].motivo).toBe('Dado de baja del inventario');
    expect(crear.mock.calls[0][0].foto_ruta).toBeNull();
    expect(insumo.estado).toBe('dado_de_baja');
    expect(insumo.ambulanciaId).toBeNull();
    expect(res.json).toHaveBeenCalledWith({ message: 'Insumo dado de baja correctamente', id: 1 });
  });

  it('eliminarLogico: 404 si no existe', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(null);

    await ctrl.eliminarLogico({ params: { id: '1' }, body: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('cambiarEstado: 400 con un estado inválido', async () => {
    await ctrl.cambiarEstado({ params: { id: '1' }, body: { estado: 'roto' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Estado inválido. Válidos: activo, dado_de_baja',
    });
  });

  it('cambiarEstado: actualiza el estado y guarda el motivo en observaciones', async () => {
    const insumo = insumoFalso();
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumo);

    await ctrl.cambiarEstado({ params: { id: '1' }, body: { estado: 'dado_de_baja', motivo: ' Roto ' } }, res, next);

    expect(insumo.estado).toBe('dado_de_baja');
    expect(insumo.observaciones).toBe('Roto');
    expect(insumo.save).toHaveBeenCalled();
  });

  it('cambiarEstado: 404 si no existe', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(null);

    await ctrl.cambiarEstado({ params: { id: '1' }, body: { estado: 'activo' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('historial: devuelve el insumo con sus movimientos legacy', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(insumoFalso());
    vi.spyOn(MovimientoInventario, 'findAll').mockResolvedValue([{ id: 1 }]);

    await ctrl.historial({ params: { id: '1' } }, res, next);

    const cuerpo = res.json.mock.calls[0][0];
    expect(cuerpo.insumo.codigo).toBe('INS-COL-001');
    expect(cuerpo.movimientos).toEqual([{ id: 1 }]);
  });

  it('historial: 404 si no existe', async () => {
    vi.spyOn(Insumo, 'findByPk').mockResolvedValue(null);

    await ctrl.historial({ params: { id: '1' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('registrarMovimiento: responde 410 (endpoint reemplazado)', async () => {
    await ctrl.registrarMovimiento({}, res, next);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json.mock.calls[0][0].message).toContain('fue reemplazado');
  });
});
