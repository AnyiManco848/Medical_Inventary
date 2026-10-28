import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtAdmin, jwtAmbulancia, cookiesCon, rutasGet } from './helpers.js';

const push = vi.fn();
const router = { push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('js-cookie', () => ({ default: { get: vi.fn(), remove: vi.fn() } }));

// Las exportaciones se cargan con import() dinámico; vi.mock también las intercepta.
const exp = vi.hoisted(() => {
  const doc = { setFontSize: vi.fn(), setTextColor: vi.fn(), text: vi.fn(), save: vi.fn() };
  return {
    doc,
    jsPDF: vi.fn(function () { return doc; }),
    autoTable: vi.fn(),
    xlsx: {
      utils: { aoa_to_sheet: vi.fn(() => 'HOJA'), book_new: vi.fn(() => 'LIBRO'), book_append_sheet: vi.fn() },
      writeFile: vi.fn(),
    },
  };
});
vi.mock('jspdf', () => ({ default: exp.jsPDF }));
vi.mock('jspdf-autotable', () => ({ default: exp.autoTable }));
vi.mock('xlsx', () => exp.xlsx);

import ReportesAdminPage from '../app/dashboard/reportes-admin/page';

const API = 'http://localhost:4000';
const AMBULANCIAS = [{ id: 5, codigo: 'AMB-05', descripcion: 'Básica' }, { id: 6, codigo: 'AMB-06', descripcion: null }];
const CENTROS = [{ id: 1, nombre: 'Hospital General' }, { id: 2, nombre: 'Clínica Norte' }, { id: 99, nombre: 'Otro', esOtro: true }];

const reg = (id, extra = {}) => ({
  id, codigoInsumo: `INS-${id}`, insumoNombre: `Insumo ${id}`, centroNombre: 'Hospital General', centroOtro: null,
  fecha: '2026-04-02', hora: null, ambulanciaCodigo: 'AMB-05', usuarioEntrega: 'Paramédico',
  usuarioRecogida: null, estadoActual: 'En centro asistencial', ...extra,
});
const HISTORIAL = [
  reg(1, { hora: '14:35:00', centroOtro: 'Puesto de salud vereda', usuarioRecogida: 'Conductor', estadoActual: 'Recuperado' }),
  reg(2, { codigoInsumo: null, insumoNombre: null, centroNombre: null, ambulanciaCodigo: null, usuarioEntrega: null, estadoActual: null, fecha: null }),
];
const COLUMNAS_HIST = ['Código', 'Insumo', 'Centro asistencial', 'Fecha entrega', 'Ambulancia', 'Entregado por', 'Recuperado por', 'Estado'];
const FILAS_HIST = [
  ['INS-1', 'Insumo 1', 'Puesto de salud vereda', '02-04-2026 14:35', 'AMB-05', 'Paramédico', 'Conductor', 'Recuperado'],
  ['—', '—', '—', '—', '—', '—', '—', '—'],
];

let token;
const cabeceras = () => ({ Authorization: `Bearer ${token}` });
const filasTabla = () => screen.getAllByRole('row').slice(1).map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent));
const fechas = (c) => c.querySelectorAll('input[type="date"]');

async function montar(rutas = {}, cookies = {}) {
  token = jwtAdmin();
  cookiesCon(Cookies, { token, ...cookies });
  rutasGet(axios, { '/api/ambulancias': AMBULANCIAS, '/api/centros': CENTROS, ...rutas });
  const r = render(<ReportesAdminPage />);
  await screen.findByRole('option', { name: 'AMB-05 · Básica' });
  return r;
}

beforeEach(() => {
  push.mockReset();
});

describe('reportes-admin/page.js · acceso y carga de catálogos', () => {
  it('sin token va al login', () => {
    cookiesCon(Cookies, {});

    render(<ReportesAdminPage />);

    expect(push).toHaveBeenCalledWith('/login');
    expect(axios.get).not.toHaveBeenCalled();
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it.each([
    ['token ilegible', 'nada'],
    ['token vencido', jwtAdmin({ exp: Math.floor(Date.now() / 1000) - 5 })],
  ])('con %s borra las cookies y va al login', (_c, t) => {
    cookiesCon(Cookies, { token: t });

    render(<ReportesAdminPage />);

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(Cookies.remove).toHaveBeenCalledWith('usuario');
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('el rol ambulancia se manda al dashboard', () => {
    cookiesCon(Cookies, { token: jwtAmbulancia() });

    render(<ReportesAdminPage />);

    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('carga ambulancias y centros (sin "Otro") para los filtros', async () => {
    await montar({}, { usuario: JSON.stringify({ nombre: 'Ana Admin', rol: 'admin' }) });

    expect(axios.get).toHaveBeenCalledWith(`${API}/api/ambulancias`, { headers: cabeceras() });
    expect(axios.get).toHaveBeenCalledWith(`${API}/api/centros`, { headers: cabeceras() });
    expect(screen.getByText('Ana Admin')).toBeInTheDocument();
    const [selAmb, selCentro] = screen.getAllByRole('combobox');
    expect([...selAmb.options].map((o) => o.textContent)).toEqual(['Todas las ambulancias', 'AMB-05 · Básica', 'AMB-06']);
    expect([...selCentro.options].map((o) => o.textContent)).toEqual(['Todos los centros', 'Hospital General', 'Clínica Norte']);
    expect(screen.getByText('Buscar', { selector: 'strong' })).toBeInTheDocument();
  });

  it.each([['sin cookie usuario', undefined], ['con cookie usuario corrupta', '{x']])(
    '%s usa el numero_ambulancia del token',
    async (_c, usuario) => {
      await montar({}, { usuario });

      expect(screen.getByText('Administrador01')).toBeInTheDocument();
    },
  );

  it('si los catálogos fallan la página sigue usable con los selects vacíos', async () => {
    token = jwtAdmin();
    cookiesCon(Cookies, { token });
    rutasGet(axios, { '/api/ambulancias': new Error('x'), '/api/centros': CENTROS });

    render(<ReportesAdminPage />);

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    const [selAmb, selCentro] = screen.getAllByRole('combobox');
    expect(selAmb.options).toHaveLength(1);
    expect(selCentro.options).toHaveLength(1);
  });

  it('respuestas sin datos se tratan como listas vacías', async () => {
    token = jwtAdmin();
    cookiesCon(Cookies, { token });
    rutasGet(axios, { '/api/ambulancias': null, '/api/centros': null });

    render(<ReportesAdminPage />);

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(screen.getAllByRole('combobox')[0].options).toHaveLength(1);
  });

  it('cerrar sesión borra las cookies y va al login', async () => {
    await montar();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(Cookies.remove).toHaveBeenCalledWith('usuario');
    expect(push).toHaveBeenCalledWith('/login');
  });
});

describe('reportes-admin/page.js · historial', () => {
  it('Buscar sin filtros pide el historial sin parámetros y pinta cada columna', async () => {
    await montar({ '/api/reportes/admin/historial': HISTORIAL });

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText('2 resultado(s)')).toBeInTheDocument();
    expect(axios.get).toHaveBeenLastCalledWith(`${API}/api/reportes/admin/historial`, { headers: cabeceras(), params: {} });
    expect(filasTabla()).toEqual([
      ['INS-1', 'Insumo 1', 'Puesto de salud vereda', '02-04-202614:35', 'AMB-05', 'Paramédico', 'Conductor', '✓ Recuperado'],
      ['—', '—', '—', '—', '—', '—', '—', '⏳ En centro'],
    ]);
  });

  it('envía solo los filtros con valor (insumo recortado) y Enter también busca', async () => {
    const { container } = await montar({ '/api/reportes/admin/historial': [] });
    const [selAmb, selCentro] = screen.getAllByRole('combobox');
    const [desde, hasta] = fechas(container);
    const buscador = screen.getByPlaceholderText('Buscar insumo o código...');

    fireEvent.change(buscador, { target: { value: '  collarín ' } });
    fireEvent.change(selAmb, { target: { value: '5' } });
    fireEvent.change(selCentro, { target: { value: '2' } });
    fireEvent.change(desde, { target: { value: '2026-01-01' } });
    fireEvent.change(hasta, { target: { value: '2026-01-31' } });
    fireEvent.keyDown(buscador, { key: 'a' });
    expect(axios.get).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(buscador, { key: 'Enter' });

    expect(await screen.findByText('No se encontraron registros con esos filtros.')).toBeInTheDocument();
    expect(axios.get).toHaveBeenLastCalledWith(`${API}/api/reportes/admin/historial`, {
      headers: cabeceras(),
      params: { insumo: 'collarín', ambulanciaId: '5', centroId: '2', fechaDesde: '2026-01-01', fechaHasta: '2026-01-31' },
    });
    expect(screen.queryByRole('button', { name: 'PDF' })).not.toBeInTheDocument();
  });

  it('muestra "Buscando..." mientras espera y deshabilita el botón', async () => {
    let resolver;
    await montar();
    axios.get.mockImplementationOnce(() => new Promise((r) => { resolver = r; }));

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByRole('button', { name: 'Buscando...' })).toBeDisabled();
    expect(screen.getAllByText('Buscando...')).toHaveLength(2);
    resolver({ data: HISTORIAL });
    expect(await screen.findByText('2 resultado(s)')).toBeInTheDocument();
  });

  it('si la búsqueda falla muestra el error', async () => {
    await montar({ '/api/reportes/admin/historial': new Error('500') });

    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByText('No se pudo cargar el historial.')).toBeInTheDocument();
  });

  it('Limpiar vacía filtros y resultados y vuelve al mensaje inicial', async () => {
    const { container } = await montar({ '/api/reportes/admin/historial': HISTORIAL });
    fireEvent.change(screen.getByPlaceholderText('Buscar insumo o código...'), { target: { value: 'x' } });
    fireEvent.change(fechas(container)[0], { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByText('2 resultado(s)');

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));

    expect(screen.getByPlaceholderText('Buscar insumo o código...')).toHaveValue('');
    expect(fechas(container)[0]).toHaveValue('');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('Buscar', { selector: 'strong' })).toBeInTheDocument();
  });

  it('pagina de 5 en 5', async () => {
    await montar({ '/api/reportes/admin/historial': Array.from({ length: 11 }, (_, i) => reg(i + 1)) });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByText('11 resultado(s)');

    expect(filasTabla()).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (6 restantes)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (1 restante)' }));
    expect(filasTabla()).toHaveLength(11);
    expect(screen.queryByRole('button', { name: /Ver más/ })).not.toBeInTheDocument();
  });

  it('exporta a PDF con título, columnas y filas formateadas', async () => {
    await montar({ '/api/reportes/admin/historial': HISTORIAL });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByText('2 resultado(s)');

    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));

    expect(screen.getByRole('button', { name: 'PDF' })).toBeDisabled();
    await waitFor(() => expect(exp.doc.save).toHaveBeenCalledWith('trazabilidad-historial.pdf'));
    expect(exp.jsPDF).toHaveBeenCalledWith({ orientation: 'landscape' });
    expect(exp.doc.text).toHaveBeenCalledWith('MedicalInventary', 14, 14);
    expect(exp.doc.text).toHaveBeenCalledWith('Historial de Trazabilidad', 14, 22);
    expect(exp.doc.text).toHaveBeenCalledWith(expect.stringMatching(/^Generado el: .*2026/), 14, 29);
    expect(exp.autoTable).toHaveBeenCalledWith(exp.doc, expect.objectContaining({
      startY: 34, head: [COLUMNAS_HIST], body: FILAS_HIST,
    }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled());
  });

  it('exporta a Excel con la hoja "Historial"', async () => {
    await montar({ '/api/reportes/admin/historial': HISTORIAL });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByText('2 resultado(s)');

    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));

    await waitFor(() => expect(exp.xlsx.writeFile).toHaveBeenCalledWith('LIBRO', 'trazabilidad-historial.xlsx'));
    expect(exp.xlsx.utils.aoa_to_sheet).toHaveBeenCalledWith([COLUMNAS_HIST, ...FILAS_HIST]);
    expect(exp.xlsx.utils.book_append_sheet).toHaveBeenCalledWith('LIBRO', 'HOJA', 'Historial');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Excel' })).toBeEnabled());
  });
});

describe('reportes-admin/page.js · errores al exportar', () => {
  it.each([
    ['PDF', () => exp.autoTable.mockImplementationOnce(() => { throw new Error('jspdf'); }), 'No se pudo generar el PDF. Inténtalo de nuevo.'],
    ['Excel', () => exp.xlsx.writeFile.mockImplementationOnce(() => { throw new Error('xlsx'); }), 'No se pudo generar el archivo Excel. Inténtalo de nuevo.'],
  ])('historial: si falla el %s avisa al usuario y reactiva los botones', async (boton, romper, mensaje) => {
    await montar({ '/api/reportes/admin/historial': HISTORIAL });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await screen.findByText('2 resultado(s)');
    romper();

    fireEvent.click(screen.getByRole('button', { name: boton }));

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: boton })).toBeEnabled();
    // Un intento nuevo que sale bien quita el aviso
    fireEvent.click(screen.getByRole('button', { name: boton }));
    await waitFor(() => expect(screen.queryByText(mensaje)).not.toBeInTheDocument());
  });

  it.each([
    ['PDF', () => exp.jsPDF.mockImplementationOnce(() => { throw new Error('jspdf'); }), 'No se pudo generar el PDF. Inténtalo de nuevo.'],
    ['Excel', () => exp.xlsx.utils.aoa_to_sheet.mockImplementationOnce(() => { throw new Error('xlsx'); }), 'No se pudo generar el archivo Excel. Inténtalo de nuevo.'],
  ])('pendientes: si falla el %s avisa al usuario', async (boton, romper, mensaje) => {
    await montar({ '/api/reportes/admin/pendientes': [{ id: 1, codigoInsumo: 'P-1', fecha: '2026-05-10' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Pendientes de recuperación' }));
    await screen.findByText('1 insumo(s) pendiente(s) de recuperación');
    romper();

    fireEvent.click(screen.getByRole('button', { name: boton }));

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: boton })).toBeEnabled();
  });
});

describe('reportes-admin/page.js · pendientes', () => {
  const pend = (id, extra = {}) => ({
    id, codigoInsumo: `P-${id}`, insumoNombre: `Pendiente ${id}`, centroNombre: 'Hospital General', centroOtro: null,
    fecha: '2026-05-10', ambulanciaId: 5, ambulanciaCodigo: 'AMB-05', usuarioNombre: 'Paramédico', ...extra,
  });
  const PENDIENTES = [
    pend(1, { centroOtro: 'Puesto vereda' }),
    pend(2, { ambulanciaId: null }),
    pend(3, { ambulanciaId: 6, ambulanciaCodigo: 'AMB-06' }),
    pend(4, { codigoInsumo: null, insumoNombre: null, centroNombre: null, ambulanciaId: null, ambulanciaCodigo: null, usuarioNombre: null }),
  ];
  const COLUMNAS_PEND = ['Código', 'Insumo', 'Centro asistencial', 'Fecha entrega', 'Ambulancia', 'Registrado por'];
  const FILAS_PEND = [
    ['P-1', 'Pendiente 1', 'Puesto vereda', '10-05-2026', 'AMB-05', 'Paramédico'],
    ['P-2', 'Pendiente 2', 'Hospital General', '10-05-2026', 'AMB-05', 'Paramédico'],
    ['P-3', 'Pendiente 3', 'Hospital General', '10-05-2026', 'AMB-06', 'Paramédico'],
    ['—', '—', '—', '10-05-2026', '—', '—'],
  ];

  async function abrir(pendientes = PENDIENTES) {
    const r = await montar({ '/api/reportes/admin/pendientes': pendientes });
    fireEvent.click(screen.getByRole('button', { name: 'Pendientes de recuperación' }));
    return r;
  }

  it('al abrir la pestaña carga los pendientes sin filtros y los pinta', async () => {
    await abrir();

    expect(await screen.findByText('4 insumo(s) pendiente(s) de recuperación')).toBeInTheDocument();
    expect(axios.get).toHaveBeenLastCalledWith(`${API}/api/reportes/admin/pendientes`, { headers: cabeceras(), params: {} });
    expect(filasTabla()).toEqual(FILAS_PEND);
    expect(screen.getByRole('button', { name: 'Pendientes de recuperación' })).toHaveStyle({ color: 'rgb(255, 255, 255)' });
  });

  it('filtra por ambulancia por id o, si falta el id, por código; y envía las fechas', async () => {
    const { container } = await abrir();
    await screen.findByText('4 insumo(s) pendiente(s) de recuperación');
    const [desde, hasta] = fechas(container);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } });
    fireEvent.change(desde, { target: { value: '2026-05-01' } });
    fireEvent.change(hasta, { target: { value: '2026-05-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    expect(await screen.findByText('2 insumo(s) pendiente(s) de recuperación')).toBeInTheDocument();
    expect(axios.get).toHaveBeenLastCalledWith(`${API}/api/reportes/admin/pendientes`, {
      headers: cabeceras(), params: { fechaDesde: '2026-05-01', fechaHasta: '2026-05-31' },
    });
    expect(filasTabla().map((f) => f[0])).toEqual(['P-1', 'P-2']);
  });

  it('una ambulancia que no está en el catálogo solo coincide por id', async () => {
    await abrir([pend(1, { ambulanciaId: 77, ambulanciaCodigo: 'AMB-77' }), pend(2)]);
    await screen.findByText('2 insumo(s) pendiente(s) de recuperación');
    const select = screen.getByRole('combobox');
    // Se agrega una opción que no viene del catálogo para simular un id desconocido
    const opcion = document.createElement('option');
    opcion.value = '77';
    select.appendChild(opcion);

    fireEvent.change(select, { target: { value: '77' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    expect(await screen.findByText('1 insumo(s) pendiente(s) de recuperación')).toBeInTheDocument();
    expect(filasTabla()[0][0]).toBe('P-1');
  });

  it('sin resultados muestra el mensaje de filtros aplicados', async () => {
    await abrir([]);

    expect(await screen.findByText('No hay insumos pendientes de recuperación con los filtros aplicados.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'PDF' })).not.toBeInTheDocument();
  });

  it('si la carga falla muestra el error', async () => {
    await montar({ '/api/reportes/admin/pendientes': new Error('500') });

    fireEvent.click(screen.getByRole('button', { name: 'Pendientes de recuperación' }));

    expect(await screen.findByText('No se pudo cargar los insumos pendientes.')).toBeInTheDocument();
  });

  it('muestra "Cargando..." mientras espera', async () => {
    let resolver;
    await montar();
    axios.get.mockImplementationOnce(() => new Promise((r) => { resolver = r; }));

    fireEvent.click(screen.getByRole('button', { name: 'Pendientes de recuperación' }));

    expect(await screen.findByRole('button', { name: 'Buscando...' })).toBeDisabled();
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
    resolver({ data: [] });
    expect(await screen.findByText('No hay insumos pendientes de recuperación con los filtros aplicados.')).toBeInTheDocument();
  });

  it('Limpiar filtros vacía los campos sin volver a consultar', async () => {
    const { container } = await abrir();
    await screen.findByText('4 insumo(s) pendiente(s) de recuperación');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '6' } });
    fireEvent.change(fechas(container)[1], { target: { value: '2026-05-31' } });
    const llamadas = axios.get.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(fechas(container)[1]).toHaveValue('');
    expect(axios.get).toHaveBeenCalledTimes(llamadas);
  });

  it('pagina de 5 en 5', async () => {
    await abrir(Array.from({ length: 7 }, (_, i) => pend(i + 1)));
    await screen.findByText('7 insumo(s) pendiente(s) de recuperación');

    expect(filasTabla()).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (2 restantes)' }));
    expect(filasTabla()).toHaveLength(7);
  });

  it('exporta pendientes a PDF y a Excel', async () => {
    await abrir();
    await screen.findByText('4 insumo(s) pendiente(s) de recuperación');

    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    await waitFor(() => expect(exp.doc.save).toHaveBeenCalledWith('insumos-pendientes.pdf'));
    expect(exp.doc.text).toHaveBeenCalledWith('Insumos Pendientes en Centros Asistenciales', 14, 22);
    expect(exp.autoTable).toHaveBeenCalledWith(exp.doc, expect.objectContaining({ head: [COLUMNAS_PEND], body: FILAS_PEND }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Excel' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Excel' }));
    await waitFor(() => expect(exp.xlsx.writeFile).toHaveBeenCalledWith('LIBRO', 'insumos-pendientes.xlsx'));
    expect(exp.xlsx.utils.aoa_to_sheet).toHaveBeenCalledWith([COLUMNAS_PEND, ...FILAS_PEND]);
    expect(exp.xlsx.utils.book_append_sheet).toHaveBeenCalledWith('LIBRO', 'HOJA', 'Pendientes');
    await waitFor(() => expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled());
  });

  it('volver a la pestaña de historial la muestra de nuevo', async () => {
    await abrir();
    await screen.findByText('4 insumo(s) pendiente(s) de recuperación');

    fireEvent.click(screen.getByRole('button', { name: 'Historial completo' }));

    expect(screen.getByPlaceholderText('Buscar insumo o código...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aplicar filtros' })).not.toBeInTheDocument();
  });
});
