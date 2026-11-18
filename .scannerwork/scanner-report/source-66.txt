import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cjs, crearRes } from '../helpers.js';

const { Insumo, CentroAsistencial, MovimientoInsumo, ReporteInsumo, Usuario } = cjs('../src/models');
const {
  getCentros, crearEntrega, getHistorial, ultimoPorInsumo, crearRecogida, crearDanoPerdida,
} = cjs('../src/controllers/movimientos.controller');

const insumoFalso = { id: 11, codigo: 'INS-COL-001', nombre: 'Collarín cervical adulto' };
const usuarioReq = { id: 4, rol: 'ambulancia' };

const cuerpoMovimiento = {
  codigoInsumo: 'ins-col-001',
  nombrePaciente: 'Paciente Prueba',
  historiaClinica: 'HC-123',
  centroAsistencialId: 2,
  fecha: '2026-10-25',
  hora: '14:30',
  tripulacion: 'Equipo A',
  nombreMedico: 'Dra. Ejemplo',
};

describe.each([
  ['crearEntrega', crearEntrega, 'entrega', 'Entrega registrada exitosamente'],
  ['crearRecogida', crearRecogida, 'recogida', 'Recogida registrada exitosamente'],
])('movimientos.controller · %s', (_nombre, handler, tipo, mensajeOk) => {
  let res;
  let next;

  beforeEach(() => {
    res = crearRes();
    next = vi.fn();
  });

  it('400 si no se envía el código del insumo', async () => {
    await handler({ body: {}, usuario: usuarioReq }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El código del insumo es requerido' });
  });

  it('404 si no encuentra el insumo ni por código ni por QR', async () => {
    const spy = vi.spyOn(Insumo, 'findOne').mockResolvedValue(null);

    await handler({ body: cuerpoMovimiento, usuario: usuarioReq }, res, next);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Insumo no encontrado con ese código' });
  });

  it('busca el código en mayúsculas', async () => {
    const spy = vi.spyOn(Insumo, 'findOne').mockResolvedValue(insumoFalso);
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue({ id: 4, ambulanciaId: 9 });
    vi.spyOn(MovimientoInsumo, 'create').mockResolvedValue({ id: 1 });

    await handler({ body: cuerpoMovimiento, usuario: usuarioReq }, res, next);

    expect(spy.mock.calls[0][0].where).toEqual({ codigo: 'INS-COL-001' });
  });

  it('si el código no existe, reintenta por el UUID del QR', async () => {
    const spy = vi.spyOn(Insumo, 'findOne')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(insumoFalso);
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue({ id: 4, ambulanciaId: 9 });
    vi.spyOn(MovimientoInsumo, 'create').mockResolvedValue({ id: 1 });

    await handler({ body: { ...cuerpoMovimiento, codigoInsumo: 'uuid-del-qr' }, usuario: usuarioReq }, res, next);

    expect(spy.mock.calls[1][0].where).toEqual({ codigo_qr: 'uuid-del-qr' });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it(`201: registra el movimiento de tipo "${tipo}" con la ambulancia del usuario`, async () => {
    vi.spyOn(Insumo, 'findOne').mockResolvedValue(insumoFalso);
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue({ id: 4, ambulanciaId: 9 });
    const createSpy = vi.spyOn(MovimientoInsumo, 'create').mockResolvedValue({ id: 50 });

    await handler({ body: cuerpoMovimiento, usuario: usuarioReq }, res, next);

    expect(createSpy.mock.calls[0][0]).toMatchObject({
      tipo,
      insumoId: 11,
      codigoInsumo: 'INS-COL-001',
      nombrePaciente: 'Paciente Prueba',
      centroAsistencialId: 2,
      fecha: '2026-10-25',
      hora: '14:30',
      ambulanciaId: 9,
      usuarioId: 4,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: mensajeOk, movimiento: { id: 50 } });
  });

  it('guarda null en los campos opcionales que no llegan', async () => {
    vi.spyOn(Insumo, 'findOne').mockResolvedValue(insumoFalso);
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue({ id: 4, ambulanciaId: null });
    const createSpy = vi.spyOn(MovimientoInsumo, 'create').mockResolvedValue({ id: 51 });

    await handler(
      { body: { codigoInsumo: 'INS-COL-001', fecha: '2026-10-25', hora: '10:00' }, usuario: usuarioReq },
      res,
      next,
    );

    expect(createSpy.mock.calls[0][0]).toMatchObject({
      nombrePaciente: null,
      historiaClinica: null,
      centroAsistencialId: null,
      centroOtro: null,
      tripulacion: null,
      nombreMedico: null,
      ambulanciaId: null,
    });
  });

  it('delega en next(error) si la base de datos falla', async () => {
    const error = new Error('DB caída');
    vi.spyOn(Insumo, 'findOne').mockRejectedValue(error);

    await handler({ body: cuerpoMovimiento, usuario: usuarioReq }, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('movimientos.controller · getCentros', () => {
  it('devuelve solo centros activos, dejando "Otro" al final', async () => {
    const res = crearRes();
    const centros = [{ id: 1, nombre: 'Hospital A' }];
    const spy = vi.spyOn(CentroAsistencial, 'findAll').mockResolvedValue(centros);

    await getCentros({}, res, vi.fn());

    const opciones = spy.mock.calls[0][0];
    expect(opciones.where).toEqual({ activo: true });
    expect(opciones.order).toEqual([['esOtro', 'ASC'], ['nombre', 'ASC']]);
    expect(res.json).toHaveBeenCalledWith(centros);
  });
});

describe('movimientos.controller · getHistorial', () => {
  it('devuelve lista vacía si el usuario no tiene ambulancia asignada', async () => {
    const res = crearRes();
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue({ id: 4, ambulanciaId: null });
    const findAll = vi.spyOn(MovimientoInsumo, 'findAll');

    await getHistorial({ usuario: usuarioReq }, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith([]);
    expect(findAll).not.toHaveBeenCalled();
  });

  it('trae los últimos 30 movimientos de la ambulancia del usuario', async () => {
    const res = crearRes();
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue({ id: 4, ambulanciaId: 9 });
    const spy = vi.spyOn(MovimientoInsumo, 'findAll').mockResolvedValue([{ id: 1 }]);

    await getHistorial({ usuario: usuarioReq }, res, vi.fn());

    const opciones = spy.mock.calls[0][0];
    expect(opciones.where).toEqual({ ambulanciaId: 9 });
    expect(opciones.limit).toBe(30);
    expect(opciones.order).toEqual([['createdAt', 'DESC']]);
    expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
  });
});

describe('movimientos.controller · ultimoPorInsumo', () => {
  it('400 si falta el parámetro codigo', async () => {
    const res = crearRes();

    await ultimoPorInsumo({ query: {} }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('404 si el insumo no existe', async () => {
    const res = crearRes();
    vi.spyOn(Insumo, 'findOne').mockResolvedValue(null);

    await ultimoPorInsumo({ query: { codigo: 'X' } }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('devuelve el insumo y su última entrega', async () => {
    const res = crearRes();
    vi.spyOn(Insumo, 'findOne').mockResolvedValue(insumoFalso);
    const ultima = { id: 77, tipo: 'entrega' };
    const spy = vi.spyOn(MovimientoInsumo, 'findOne').mockResolvedValue(ultima);

    await ultimoPorInsumo({ query: { codigo: 'ins-col-001' } }, res, vi.fn());

    expect(spy.mock.calls[0][0].where).toEqual({ insumoId: 11, tipo: 'entrega' });
    expect(res.json).toHaveBeenCalledWith({
      insumo: { id: 11, codigo: 'INS-COL-001', nombre: 'Collarín cervical adulto' },
      ultimaEntrega: ultima,
    });
  });
});

describe('movimientos.controller · crearDanoPerdida', () => {
  let res;
  let next;
  const cuerpo = {
    tipo: 'dano',
    codigoInsumo: 'INS-COL-001',
    motivo: '  Se rompió el cierre  ',
    fecha: '2026-10-25',
    hora: '09:00',
  };

  beforeEach(() => {
    res = crearRes();
    next = vi.fn();
  });

  it('400 si el tipo no es "dano" ni "perdida"', async () => {
    await crearDanoPerdida({ body: { ...cuerpo, tipo: 'robo' }, usuario: usuarioReq }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'tipo debe ser "dano" o "perdida"' });
  });

  it('400 si falta el código del insumo', async () => {
    await crearDanoPerdida({ body: { ...cuerpo, codigoInsumo: '' }, usuario: usuarioReq }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 si el motivo está vacío o son solo espacios', async () => {
    await crearDanoPerdida({ body: { ...cuerpo, motivo: '   ' }, usuario: usuarioReq }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El motivo es requerido' });
  });

  it('404 si el insumo no existe', async () => {
    vi.spyOn(Insumo, 'findOne').mockResolvedValue(null);

    await crearDanoPerdida({ body: cuerpo, usuario: usuarioReq }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('201: crea el reporte con motivo recortado y rutas de las fotos subidas', async () => {
    vi.spyOn(Insumo, 'findOne').mockResolvedValue(insumoFalso);
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue({ id: 4, ambulanciaId: 9 });
    const spy = vi.spyOn(ReporteInsumo, 'create').mockResolvedValue({ id: 3 });
    const files = [{ filename: 'a.jpg' }, { filename: 'b.png' }];

    await crearDanoPerdida({ body: cuerpo, files, usuario: usuarioReq }, res, next);

    expect(spy.mock.calls[0][0]).toMatchObject({
      tipo: 'dano',
      insumoId: 11,
      motivo: 'Se rompió el cierre',
      fotosRutas: ['/uploads/evidencias/a.jpg', '/uploads/evidencias/b.png'],
      ambulanciaId: 9,
      usuarioId: 4,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('acepta reportes sin fotos (fotosRutas vacío)', async () => {
    vi.spyOn(Insumo, 'findOne').mockResolvedValue(insumoFalso);
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue({ id: 4, ambulanciaId: 9 });
    const spy = vi.spyOn(ReporteInsumo, 'create').mockResolvedValue({ id: 4 });

    await crearDanoPerdida({ body: { ...cuerpo, tipo: 'perdida' }, usuario: usuarioReq }, res, next);

    expect(spy.mock.calls[0][0].fotosRutas).toEqual([]);
    expect(spy.mock.calls[0][0].tipo).toBe('perdida');
  });
});
