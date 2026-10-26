import { describe, it, expect, vi } from 'vitest';
import { cjs, crearRes } from '../helpers.js';

const { Ambulancia, CentroAsistencial, MovimientoInsumo } = cjs('../src/models');
const ambulancias = cjs('../src/controllers/ambulancia.controller');
const centros = cjs('../src/controllers/centros.controller');

describe('ambulancia.controller · crear', () => {
  it('400 si faltan código o placa', async () => {
    const res = crearRes();

    await ambulancias.crear({ body: { codigo: 'AMB-01' } }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Código y placa son requeridos' });
  });

  it('409 si ya existe una ambulancia con ese código', async () => {
    const res = crearRes();
    vi.spyOn(Ambulancia, 'findOne').mockResolvedValueOnce({ id: 1 });

    await ambulancias.crear({ body: { codigo: 'AMB-01', placa: 'abc123' } }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Ya existe una ambulancia con ese código' });
  });

  it('409 si ya existe una ambulancia con esa placa', async () => {
    const res = crearRes();
    vi.spyOn(Ambulancia, 'findOne')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 2 });

    await ambulancias.crear({ body: { codigo: 'AMB-02', placa: 'abc123' } }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Ya existe una ambulancia con esa placa' });
  });

  it('201: normaliza código (trim) y placa (trim + mayúsculas) y la crea activa', async () => {
    const res = crearRes();
    vi.spyOn(Ambulancia, 'findOne').mockResolvedValue(null);
    const spy = vi.spyOn(Ambulancia, 'create').mockResolvedValue({ id: 3 });

    await ambulancias.crear(
      { body: { codigo: '  AMB-03 ', placa: ' abc123 ', descripcion: '  Básica  ' } },
      res,
      vi.fn(),
    );

    expect(spy.mock.calls[0][0]).toEqual({
      codigo: 'AMB-03',
      placa: 'ABC123',
      descripcion: 'Básica',
      activa: true,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('ambulancia.controller · listar', () => {
  it('filtra por estado activa=true', async () => {
    const res = crearRes();
    const spy = vi.spyOn(Ambulancia, 'findAll').mockResolvedValue([]);

    await ambulancias.listar({ query: { activa: 'true' } }, res, vi.fn());

    expect(spy.mock.calls[0][0].where.activa).toBe(true);
  });

  it('filtra por estado activa=false', async () => {
    const res = crearRes();
    const spy = vi.spyOn(Ambulancia, 'findAll').mockResolvedValue([]);

    await ambulancias.listar({ query: { activa: 'false' } }, res, vi.fn());

    expect(spy.mock.calls[0][0].where.activa).toBe(false);
  });

  it('sin filtros no restringe por estado', async () => {
    const res = crearRes();
    const spy = vi.spyOn(Ambulancia, 'findAll').mockResolvedValue([]);

    await ambulancias.listar({ query: {} }, res, vi.fn());

    expect(spy.mock.calls[0][0].where).toEqual({});
  });
});

describe('ambulancia.controller · editar / toggle / eliminar', () => {
  it('editar: 404 si no existe', async () => {
    const res = crearRes();
    vi.spyOn(Ambulancia, 'findByPk').mockResolvedValue(null);

    await ambulancias.editar({ params: { id: '1' }, body: {} }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('editar: 409 si el nuevo código ya lo usa otra ambulancia', async () => {
    const res = crearRes();
    vi.spyOn(Ambulancia, 'findByPk').mockResolvedValue({
      codigo: 'AMB-01', placa: 'AAA111', save: vi.fn(),
    });
    vi.spyOn(Ambulancia, 'findOne').mockResolvedValue({ id: 9 });

    await ambulancias.editar({ params: { id: '1' }, body: { codigo: 'AMB-09' } }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('editar: guarda cambios válidos', async () => {
    const res = crearRes();
    const amb = { codigo: 'AMB-01', placa: 'AAA111', descripcion: null, save: vi.fn() };
    vi.spyOn(Ambulancia, 'findByPk').mockResolvedValue(amb);
    vi.spyOn(Ambulancia, 'findOne').mockResolvedValue(null);

    await ambulancias.editar(
      { params: { id: '1' }, body: { placa: 'bbb222', descripcion: ' Nueva ' } },
      res,
      vi.fn(),
    );

    expect(amb.placa).toBe('BBB222');
    expect(amb.descripcion).toBe('Nueva');
    expect(amb.save).toHaveBeenCalled();
  });

  it('toggleActiva invierte el estado', async () => {
    const res = crearRes();
    const amb = { activa: true, save: vi.fn() };
    vi.spyOn(Ambulancia, 'findByPk').mockResolvedValue(amb);

    await ambulancias.toggleActiva({ params: { id: '1' } }, res, vi.fn());

    expect(amb.activa).toBe(false);
    expect(amb.save).toHaveBeenCalled();
  });

  it('eliminar: 409 si tiene movimientos registrados', async () => {
    const res = crearRes();
    const amb = { destroy: vi.fn() };
    vi.spyOn(Ambulancia, 'findByPk').mockResolvedValue(amb);
    vi.spyOn(MovimientoInsumo, 'count').mockResolvedValue(3);

    await ambulancias.eliminar({ params: { id: '1' } }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toContain('3 movimiento(s)');
    expect(amb.destroy).not.toHaveBeenCalled();
  });

  it('eliminar: borra la ambulancia si no tiene movimientos', async () => {
    const res = crearRes();
    const amb = { destroy: vi.fn().mockResolvedValue(undefined) };
    vi.spyOn(Ambulancia, 'findByPk').mockResolvedValue(amb);
    vi.spyOn(MovimientoInsumo, 'count').mockResolvedValue(0);

    await ambulancias.eliminar({ params: { id: '1' } }, res, vi.fn());

    expect(amb.destroy).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Ambulancia eliminada correctamente' });
  });
});

describe('centros.controller', () => {
  it('crear: 400 si el nombre está vacío', async () => {
    const res = crearRes();

    await centros.crear({ body: { nombre: '   ' } }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El nombre es obligatorio.' });
  });

  it('crear: 409 si el nombre ya existe', async () => {
    const res = crearRes();
    vi.spyOn(CentroAsistencial, 'findOne').mockResolvedValue({ id: 1 });

    await centros.crear({ body: { nombre: 'Hospital A' } }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('crear: 201 con municipio por defecto "Valle de Aburrá" y activo', async () => {
    const res = crearRes();
    vi.spyOn(CentroAsistencial, 'findOne').mockResolvedValue(null);
    const spy = vi.spyOn(CentroAsistencial, 'create').mockResolvedValue({ id: 5 });

    await centros.crear({ body: { nombre: '  Clínica Nueva  ' } }, res, vi.fn());

    expect(spy.mock.calls[0][0]).toMatchObject({
      nombre: 'Clínica Nueva',
      municipio: 'Valle de Aburrá',
      direccion: null,
      activo: true,
      esOtro: false,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('editar: 404 si el centro no existe', async () => {
    const res = crearRes();
    vi.spyOn(CentroAsistencial, 'findByPk').mockResolvedValue(null);

    await centros.editar({ params: { id: '1' }, body: { nombre: 'X' } }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('toggleActivo invierte el estado del centro', async () => {
    const res = crearRes();
    const centro = { activo: true, update: vi.fn().mockResolvedValue(undefined) };
    vi.spyOn(CentroAsistencial, 'findByPk').mockResolvedValue(centro);

    await centros.toggleActivo({ params: { id: '1' } }, res, vi.fn());

    expect(centro.update).toHaveBeenCalledWith({ activo: false });
  });

  it('eliminar: 409 con plural correcto si tiene varios movimientos', async () => {
    const res = crearRes();
    vi.spyOn(CentroAsistencial, 'findByPk').mockResolvedValue({ destroy: vi.fn() });
    vi.spyOn(MovimientoInsumo, 'count').mockResolvedValue(2);

    await centros.eliminar({ params: { id: '1' } }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toBe(
      'No se puede eliminar: tiene 2 movimientos registrados.',
    );
  });

  it('eliminar: singular si tiene un solo movimiento', async () => {
    const res = crearRes();
    vi.spyOn(CentroAsistencial, 'findByPk').mockResolvedValue({ destroy: vi.fn() });
    vi.spyOn(MovimientoInsumo, 'count').mockResolvedValue(1);

    await centros.eliminar({ params: { id: '1' } }, res, vi.fn());

    expect(res.json.mock.calls[0][0].message).toBe(
      'No se puede eliminar: tiene 1 movimiento registrado.',
    );
  });

  it('eliminar: borra el centro si no tiene movimientos', async () => {
    const res = crearRes();
    const centro = { destroy: vi.fn().mockResolvedValue(undefined) };
    vi.spyOn(CentroAsistencial, 'findByPk').mockResolvedValue(centro);
    vi.spyOn(MovimientoInsumo, 'count').mockResolvedValue(0);

    await centros.eliminar({ params: { id: '1' } }, res, vi.fn());

    expect(centro.destroy).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: 'Centro eliminado.' });
  });
});
