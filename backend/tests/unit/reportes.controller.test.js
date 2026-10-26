import { describe, it, expect, vi } from 'vitest';
import { cjs, crearRes } from '../helpers.js';

const { sequelize } = cjs('../src/models');
const { getMisEntregas, getAdminHistorial, getAdminPendientes } = cjs(
  '../src/controllers/reportes.controller',
);

describe('reportes.controller · getMisEntregas', () => {
  it('consulta solo las entregas del usuario autenticado', async () => {
    const res = crearRes();
    const filas = [{ id: 1, estadoActual: 'Recuperado' }];
    const spy = vi.spyOn(sequelize, 'query').mockResolvedValue(filas);

    await getMisEntregas({ usuario: { id: 42 } }, res, vi.fn());

    const [sql, opciones] = spy.mock.calls[0];
    expect(sql).toContain(`e."usuarioId" = :usuarioId`);
    expect(opciones.replacements).toEqual({ usuarioId: 42 });
    expect(res.json).toHaveBeenCalledWith(filas);
  });

  it('delega en next(error) si falla la consulta', async () => {
    const error = new Error('fallo SQL');
    vi.spyOn(sequelize, 'query').mockRejectedValue(error);
    const next = vi.fn();

    await getMisEntregas({ usuario: { id: 1 } }, crearRes(), next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('reportes.controller · getAdminHistorial', () => {
  it('sin filtros solo restringe a entregas', async () => {
    const res = crearRes();
    const spy = vi.spyOn(sequelize, 'query').mockResolvedValue([]);

    await getAdminHistorial({ query: {} }, res, vi.fn());

    const [sql, opciones] = spy.mock.calls[0];
    expect(sql).toContain(`e.tipo = 'entrega'`);
    expect(sql).not.toContain(':ambulanciaId');
    expect(opciones.replacements).toEqual({});
  });

  it('aplica todos los filtros recibidos con parámetros (no concatena valores)', async () => {
    const res = crearRes();
    const spy = vi.spyOn(sequelize, 'query').mockResolvedValue([]);

    await getAdminHistorial(
      {
        query: {
          ambulanciaId: '3',
          centroId: '8',
          fechaDesde: '2026-10-01',
          fechaHasta: '2026-10-31',
          insumo: '  collarin ',
        },
      },
      res,
      vi.fn(),
    );

    const [sql, opciones] = spy.mock.calls[0];
    expect(opciones.replacements).toEqual({
      ambulanciaId: 3,
      centroId: 8,
      fechaDesde: '2026-10-01',
      fechaHasta: '2026-10-31',
      insumo: '%collarin%',
    });
    expect(sql).toContain('e."ambulanciaId" = :ambulanciaId');
    expect(sql).toContain('e.fecha >= :fechaDesde');
    expect(sql).toContain('e.fecha <= :fechaHasta');
    // El texto libre del usuario nunca debe quedar incrustado en el SQL
    expect(sql).not.toContain('collarin');
  });

  it('ignora ambulanciaId / centroId que no sean numéricos', async () => {
    const spy = vi.spyOn(sequelize, 'query').mockResolvedValue([]);

    await getAdminHistorial(
      { query: { ambulanciaId: "1; DROP TABLE x", centroId: 'abc' } },
      crearRes(),
      vi.fn(),
    );

    const [sql, opciones] = spy.mock.calls[0];
    // parseInt("1; DROP TABLE x") === 1, así que se usa solo el número
    expect(opciones.replacements.ambulanciaId).toBe(1);
    expect(opciones.replacements.centroId).toBeUndefined();
    expect(sql).not.toContain('DROP TABLE');
  });
});

describe('reportes.controller · getAdminPendientes', () => {
  it('sin fechas devuelve todas las entregas sin recogida', async () => {
    const res = crearRes();
    const filas = [{ id: 9 }];
    const spy = vi.spyOn(sequelize, 'query').mockResolvedValue(filas);

    await getAdminPendientes({ query: {} }, res, vi.fn());

    const [sql, opciones] = spy.mock.calls[0];
    expect(sql).toContain('NOT EXISTS');
    expect(opciones.replacements).toEqual({});
    expect(res.json).toHaveBeenCalledWith(filas);
  });

  it('aplica el rango de fechas como parámetros', async () => {
    const spy = vi.spyOn(sequelize, 'query').mockResolvedValue([]);

    await getAdminPendientes(
      { query: { fechaDesde: '2026-10-01', fechaHasta: '2026-10-15' } },
      crearRes(),
      vi.fn(),
    );

    const [sql, opciones] = spy.mock.calls[0];
    expect(sql).toContain('e.fecha >= :fechaDesde');
    expect(sql).toContain('e.fecha <= :fechaHasta');
    expect(opciones.replacements).toEqual({ fechaDesde: '2026-10-01', fechaHasta: '2026-10-15' });
  });
});
