import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtAdmin, jwtAmbulancia, cookiesCon, rutasGet } from './helpers.js';

const push = vi.fn();
const router = { push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));
vi.mock('js-cookie', () => ({ default: { get: vi.fn(), remove: vi.fn() } }));

import CentrosPage from '../app/dashboard/centros/page';

const API = 'http://localhost:4000';
const centro = (id, extra = {}) => ({
  id, nombre: `Centro ${id}`, municipio: 'Medellín', direccion: `Calle ${id}`, telefono: `60400${id}`,
  correo: null, fechaRegistro: '2026-03-15', activo: true, esOtro: false, ...extra,
});
const CENTROS = [
  centro(1, { nombre: 'Hospital General', correo: 'hg@hospital.com' }),
  centro(2, { nombre: 'Clínica Norte', municipio: 'Bello', direccion: null, telefono: null, fechaRegistro: null }),
  centro(3, { nombre: 'Clínica Sur', activo: false, fechaRegistro: '15/03/2026', direccion: 'Av. El Poblado' }),
  centro(99, { nombre: 'Otro', esOtro: true }),
];

let token;
const cabeceras = () => ({ headers: { Authorization: `Bearer ${token}` } });
const fila = (nombre) => screen.getByText(nombre).closest('tr');
const boton = (nombre, texto) => within(fila(nombre)).getByRole('button', { name: texto });

async function montar(lista = CENTROS, extra = {}, cookies = {}) {
  token = jwtAdmin();
  cookiesCon(Cookies, { token, ...cookies });
  rutasGet(axios, { '/api/centros': lista, ...extra });
  const r = render(<CentrosPage />);
  const visibles = lista.filter((c) => !c.esOtro);
  if (visibles.length) await screen.findByText(visibles[0].nombre);
  else await screen.findByText('No hay centros asistenciales registrados.');
  return r;
}

beforeEach(() => {
  push.mockReset();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('centros/page.js · acceso', () => {
  it('sin token va al login y no pide datos', () => {
    cookiesCon(Cookies, {});

    render(<CentrosPage />);

    expect(push).toHaveBeenCalledWith('/login');
    expect(axios.get).not.toHaveBeenCalled();
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it.each([
    ['token ilegible', 'x.y'],
    ['token vencido', jwtAdmin({ exp: Math.floor(Date.now() / 1000) - 1 })],
  ])('con %s borra las cookies y va al login', (_c, t) => {
    cookiesCon(Cookies, { token: t });

    render(<CentrosPage />);

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(Cookies.remove).toHaveBeenCalledWith('usuario');
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('el rol ambulancia se manda al dashboard', () => {
    cookiesCon(Cookies, { token: jwtAmbulancia() });

    render(<CentrosPage />);

    expect(push).toHaveBeenCalledWith('/dashboard');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('muestra el nombre de la cookie usuario', async () => {
    await montar(CENTROS, {}, { usuario: JSON.stringify({ nombre: 'Ana Admin', rol: 'admin' }) });

    expect(screen.getByText('Ana Admin')).toBeInTheDocument();
  });

  it.each([['sin cookie usuario', undefined], ['con cookie usuario corrupta', '{mal']])(
    '%s usa el numero_ambulancia del token',
    async (_c, usuario) => {
      await montar(CENTROS, {}, { usuario });

      expect(screen.getByText('Administrador01')).toBeInTheDocument();
    },
  );

  it('cerrar sesión borra las cookies y va al login', async () => {
    await montar();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(Cookies.remove).toHaveBeenCalledWith('usuario');
    expect(push).toHaveBeenCalledWith('/login');
  });
});

describe('centros/page.js · listado y búsqueda', () => {
  it('lista los centros sin el registro "Otro" y pinta cada columna', async () => {
    await montar();

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(`${API}/api/centros`, cabeceras());
    expect(screen.getByText('3 de 3 centro(s) registrado(s)')).toBeInTheDocument();
    expect(screen.queryByText('Otro')).not.toBeInTheDocument();

    const celdas = (n) => [...fila(n).querySelectorAll('td')].map((td) => td.textContent);
    expect(celdas('Hospital General').slice(0, 5)).toEqual(['Hospital General', 'Calle 1', '604001hg@hospital.com', '15-03-2026', 'Activo']);
    expect(celdas('Clínica Norte').slice(0, 5)).toEqual(['Clínica Norte', '—', '—', '—', 'Activo']);
    // Una fecha que no viene como AAAA-MM-DD se muestra tal cual
    expect(celdas('Clínica Sur').slice(3, 5)).toEqual(['15/03/2026', 'Inactivo']);
    expect(boton('Hospital General', 'Desactivar')).toBeInTheDocument();
    expect(boton('Clínica Sur', 'Activar')).toBeInTheDocument();
  });

  it('el hover cambia el fondo de la fila y lo restaura según su paridad', async () => {
    await montar();
    const par = fila('Hospital General');
    const impar = fila('Clínica Norte');

    fireEvent.mouseEnter(par);
    expect(par.style.backgroundColor).toBe('rgb(254, 249, 236)');
    fireEvent.mouseLeave(par);
    expect(par.style.backgroundColor).toBe('rgb(255, 255, 255)');
    fireEvent.mouseLeave(impar);
    expect(impar.style.backgroundColor).toBe('rgb(255, 253, 248)');
  });

  it('si la carga falla muestra el error global', async () => {
    token = jwtAdmin();
    cookiesCon(Cookies, { token });
    rutasGet(axios, { '/api/centros': new Error('caída') });

    render(<CentrosPage />);

    expect(await screen.findByText('No se pudo cargar la lista de centros asistenciales.')).toBeInTheDocument();
    expect(screen.getByText('No hay centros asistenciales registrados.')).toBeInTheDocument();
  });

  it('si solo existe "Otro" se muestra como lista vacía', async () => {
    await montar([centro(99, { esOtro: true })]);

    expect(screen.getByText('0 de 0 centro(s) registrado(s)')).toBeInTheDocument();
  });

  it.each([
    ['nombre', 'HOSPITAL', ['Hospital General']],
    ['municipio', 'bello', ['Clínica Norte']],
    ['dirección', 'poblado', ['Clínica Sur']],
  ])('busca por %s sin distinguir mayúsculas', async (_c, texto, visibles) => {
    await montar();

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, municipio o dirección...'), { target: { value: texto } });

    for (const n of ['Hospital General', 'Clínica Norte', 'Clínica Sur']) {
      if (visibles.includes(n)) expect(screen.getByText(n)).toBeInTheDocument();
      else expect(screen.queryByText(n)).not.toBeInTheDocument();
    }
    expect(screen.getByText(`${visibles.length} de 3 centro(s) registrado(s)`)).toBeInTheDocument();
  });

  it('sin coincidencias avisa y Limpiar restablece la búsqueda', async () => {
    await montar();
    const buscador = screen.getByPlaceholderText('Buscar por nombre, municipio o dirección...');

    fireEvent.change(buscador, { target: { value: 'zzz' } });
    expect(screen.getByText('No se encontraron centros con esa búsqueda.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '✕ Limpiar' }));

    expect(buscador).toHaveValue('');
    expect(screen.getByText('3 de 3 centro(s) registrado(s)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '✕ Limpiar' })).not.toBeInTheDocument();
  });

  it('pagina de 5 en 5 y buscar vuelve a mostrar solo 5', async () => {
    const muchos = Array.from({ length: 11 }, (_, i) => centro(i + 1, { nombre: `C-${i + 1}` }));
    await montar(muchos);

    expect(screen.getAllByRole('row')).toHaveLength(1 + 5);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (6 restantes)' }));
    expect(screen.getAllByRole('row')).toHaveLength(1 + 10);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (1 restante)' }));
    expect(screen.getAllByRole('row')).toHaveLength(1 + 11);
    expect(screen.queryByRole('button', { name: /Ver más/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, municipio o dirección...'), { target: { value: 'c-' } });
    expect(screen.getAllByRole('row')).toHaveLength(1 + 5);
  });
});

describe('centros/page.js · crear y editar', () => {
  const campo = (ph) => screen.getByPlaceholderText(ph);

  it('el nombre es obligatorio', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo centro asistencial' }));
    expect(screen.getByRole('heading', { name: 'Nuevo centro asistencial' })).toBeInTheDocument();

    fireEvent.change(campo('Ej: Hospital General de Medellín'), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('crea con POST enviando el formulario tal cual, recarga y cierra', async () => {
    await montar();
    let resolver;
    axios.post.mockReturnValue(new Promise((r) => { resolver = r; }));
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo centro asistencial' }));

    fireEvent.change(campo('Ej: Hospital General de Medellín'), { target: { value: 'Hospital Nuevo' } });
    fireEvent.change(campo('Ej: Calle 24 # 29-35, El Centro'), { target: { value: 'Cra 1' } });
    fireEvent.change(campo('Ej: 604 444 5555'), { target: { value: '604 1' } });
    fireEvent.change(campo('contacto@hospital.com'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('button', { name: 'Guardando...' })).toBeDisabled();
    expect(axios.post).toHaveBeenCalledWith(
      `${API}/api/centros`,
      { nombre: 'Hospital Nuevo', direccion: 'Cra 1', telefono: '604 1', correo: 'a@b.co' },
      cabeceras(),
    );

    resolver({ data: {} });

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Nuevo centro asistencial' })).not.toBeInTheDocument());
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('editar precarga los datos y hace PUT', async () => {
    await montar();
    axios.put.mockResolvedValue({ data: {} });

    fireEvent.click(boton('Hospital General', 'Editar'));
    expect(screen.getByRole('heading', { name: 'Editar: Hospital General' })).toBeInTheDocument();
    expect(campo('contacto@hospital.com')).toHaveValue('hg@hospital.com');

    fireEvent.change(campo('Ej: 604 444 5555'), { target: { value: '604 999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      `${API}/api/centros/1`,
      { nombre: 'Hospital General', direccion: 'Calle 1', telefono: '604 999', correo: 'hg@hospital.com' },
      cabeceras(),
    ));
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument());
  });

  it('editar un centro sin datos opcionales deja los campos vacíos', async () => {
    await montar();

    fireEvent.click(boton('Clínica Norte', 'Editar'));

    expect(campo('Ej: Calle 24 # 29-35, El Centro')).toHaveValue('');
    expect(campo('Ej: 604 444 5555')).toHaveValue('');
    expect(campo('contacto@hospital.com')).toHaveValue('');
  });

  it.each([
    ['con el mensaje del backend', { response: { data: { message: 'Ya existe un centro con ese nombre' } } }, 'Ya existe un centro con ese nombre'],
    ['con mensaje por defecto', new Error('red'), 'Error al guardar el centro'],
  ])('si guardar falla muestra el error %s', async (_c, err, texto) => {
    await montar();
    axios.put.mockRejectedValue(err);
    fireEvent.click(boton('Hospital General', 'Editar'));

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(texto)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('Cancelar y el fondo cierran el modal; clic dentro no', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo centro asistencial' }));
    const titulo = screen.getByRole('heading', { name: 'Nuevo centro asistencial' });

    fireEvent.click(titulo);
    expect(titulo).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo centro asistencial' }));
    fireEvent.click(screen.getByRole('heading', { level: 2 }).parentElement.parentElement);
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });
});

describe('centros/page.js · modal de insumos del centro', () => {
  const mov = (id, extra = {}) => ({
    id, insumoNombre: `Insumo ${id}`, codigoInsumo: `INS-${id}`, estadoActual: 'En centro asistencial',
    fecha: '2026-04-02', ambulanciaCodigo: 'AMB-01', usuarioEntrega: 'Paramédico', ...extra,
  });
  const MOVS = [
    mov(1, { insumoNombre: 'Collarín', codigoInsumo: 'COL-1' }),
    mov(2, { insumoNombre: null, codigoInsumo: null, estadoActual: 'Recuperado', ambulanciaCodigo: null, usuarioEntrega: null }),
  ];
  const tituloModal = () => screen.getByRole('heading', { name: 'Insumos — Hospital General' });
  const modal = () => tituloModal().closest('div').parentElement.parentElement;

  async function abrir(movs = MOVS) {
    await montar(CENTROS, { '/api/reportes/admin/historial': movs });
    fireEvent.click(boton('Hospital General', 'Ver insumos'));
    expect(within(modal()).getByText('Cargando insumos...')).toBeInTheDocument();
  }

  it('pide el historial filtrado por centro y pinta cada movimiento', async () => {
    await abrir();

    expect(await screen.findByText('Collarín')).toBeInTheDocument();
    expect(axios.get).toHaveBeenLastCalledWith(`${API}/api/reportes/admin/historial`, {
      ...cabeceras(), params: { centroId: 1 },
    });
    expect(within(modal()).getByText('2 registro(s) de entrega encontrado(s)')).toBeInTheDocument();

    const filas = within(modal()).getAllByRole('row').slice(1).map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent));
    expect(filas).toEqual([
      ['Collarín', 'COL-1', '⏳ En centro', '02-04-2026', 'AMB-01', 'Paramédico'],
      ['—', '—', '✓ Recuperado', '02-04-2026', '—', '—'],
    ]);
  });

  it('si el historial falla muestra el centro sin insumos', async () => {
    await montar(CENTROS, { '/api/reportes/admin/historial': new Error('500') });

    fireEvent.click(boton('Hospital General', 'Ver insumos'));

    expect(await screen.findByText('No hay insumos registrados en este centro.')).toBeInTheDocument();
    expect(within(modal()).getByText('0 registro(s) de entrega encontrado(s)')).toBeInTheDocument();
  });

  it.each([
    ['nombre', 'collar', 1],
    ['código', 'col-1', 1],
  ])('busca por %s (los campos vacíos no rompen la búsqueda)', async (_c, texto, n) => {
    await abrir();
    await screen.findByText('Collarín');

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o código...'), { target: { value: texto } });

    expect(within(modal()).getAllByRole('row')).toHaveLength(1 + n);
    expect(within(modal()).getByText('Collarín')).toBeInTheDocument();
  });

  it('filtra por estado, avisa si no hay resultados y Limpiar lo restablece', async () => {
    await abrir();
    await screen.findByText('Collarín');
    const select = within(modal()).getByRole('combobox');

    fireEvent.change(select, { target: { value: 'Recuperado' } });
    expect(within(modal()).getAllByRole('row')).toHaveLength(2);
    expect(within(modal()).getByText('✓ Recuperado')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o código...'), { target: { value: 'collar' } });
    expect(within(modal()).getByText('No se encontraron resultados con los filtros aplicados.')).toBeInTheDocument();

    fireEvent.click(within(modal()).getByRole('button', { name: '✕ Limpiar' }));
    expect(select).toHaveValue('');
    expect(within(modal()).getAllByRole('row')).toHaveLength(3);
  });

  it('pagina de 5 en 5 dentro del modal', async () => {
    await abrir(Array.from({ length: 7 }, (_, i) => mov(i + 1)));
    await screen.findByText('Insumo 1');

    expect(within(modal()).getAllByRole('row')).toHaveLength(1 + 5);
    fireEvent.click(within(modal()).getByRole('button', { name: 'Ver más (2 restantes)' }));
    expect(within(modal()).getAllByRole('row')).toHaveLength(1 + 7);
  });

  it('Cerrar oculta el modal de insumos', async () => {
    await abrir();
    await screen.findByText('Collarín');

    fireEvent.click(within(modal()).getByRole('button', { name: '✕ Cerrar' }));

    expect(screen.queryByRole('heading', { name: 'Insumos — Hospital General' })).not.toBeInTheDocument();
  });
});

describe('centros/page.js · activar, desactivar y eliminar', () => {
  it.each([
    ['Hospital General', 'Desactivar', '¿Desactivar el centro "Hospital General"?', 1],
    ['Clínica Sur', 'Activar', '¿Activar el centro "Clínica Sur"?', 3],
  ])('%s: %s confirma, hace PATCH y recarga', async (nombre, texto, pregunta, id) => {
    await montar();
    axios.patch.mockResolvedValue({ data: {} });

    fireEvent.click(boton(nombre, texto));

    expect(window.confirm).toHaveBeenCalledWith(pregunta);
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(axios.patch).toHaveBeenCalledWith(`${API}/api/centros/${id}/toggle`, {}, cabeceras());
  });

  it('confirmación cancelada no llama al backend (toggle ni eliminar)', async () => {
    await montar();
    window.confirm.mockReturnValue(false);

    fireEvent.click(boton('Hospital General', 'Desactivar'));
    fireEvent.click(boton('Hospital General', 'Eliminar'));

    expect(window.confirm).toHaveBeenCalledTimes(2);
    expect(axios.patch).not.toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it.each([
    ['Hospital General', 'Desactivar', { response: { data: { message: 'Tiene entregas' } } }, 'Tiene entregas'],
    ['Hospital General', 'Desactivar', new Error('red'), 'Error al desactivar el centro'],
    ['Clínica Sur', 'Activar', new Error('red'), 'Error al activar el centro'],
  ])('%s: si %s falla avisa con alert (%#)', async (nombre, texto, err, mensaje) => {
    await montar();
    axios.patch.mockRejectedValue(err);

    fireEvent.click(boton(nombre, texto));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(mensaje));
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('eliminar confirma con advertencia, hace DELETE y recarga', async () => {
    await montar();
    axios.delete.mockResolvedValue({ data: {} });

    fireEvent.click(boton('Clínica Norte', 'Eliminar'));

    expect(window.confirm).toHaveBeenCalledWith('¿Eliminar permanentemente "Clínica Norte"?\nEsta acción no se puede deshacer.');
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(axios.delete).toHaveBeenCalledWith(`${API}/api/centros/2`, cabeceras());
  });

  it.each([
    [{ response: { data: { message: 'Tiene movimientos' } } }, 'Tiene movimientos'],
    [new Error('red'), 'Error al eliminar el centro'],
  ])('si eliminar falla avisa con alert (%#)', async (err, mensaje) => {
    await montar();
    axios.delete.mockRejectedValue(err);

    fireEvent.click(boton('Clínica Norte', 'Eliminar'));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(mensaje));
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});

describe('centros/page.js · accesibilidad', () => {
  it('los labels del formulario están asociados a sus campos', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo centro asistencial' }));

    expect(screen.getByLabelText('Nombre *')).toHaveAttribute('placeholder', 'Ej: Hospital General de Medellín');
    expect(screen.getByLabelText('Dirección')).toHaveAttribute('placeholder', 'Ej: Calle 24 # 29-35, El Centro');
    expect(screen.getByLabelText('Teléfono')).toHaveAttribute('placeholder', 'Ej: 604 444 5555');
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('type', 'email');
  });
});
