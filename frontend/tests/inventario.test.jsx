import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtAdmin, jwtAmbulancia, cookiesCon, rutasGet } from './helpers.js';

const push = vi.fn();
const router = { push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('js-cookie', () => ({ default: { get: vi.fn(), remove: vi.fn() } }));

import InventarioPage from '../app/dashboard/inventario/page';

const API = 'http://localhost:4000';
const AMBULANCIAS = [{ id: 5, codigo: 'AMB-05', descripcion: 'Básica' }, { id: 6, codigo: 'AMB-06', descripcion: null }];
const ins = (id, extra = {}) => ({
  id, codigo: `INS-GEN-00${id}`, nombre: `Insumo ${id}`, familia: 'Otro', familia_abrev: 'GEN', especificaciones: null,
  ambulanciaId: null, ambulancia: null, estado: 'activo', fecha_creacion: '01-02-2026', fecha_modificacion: '03-02-2026', ...extra,
});
const INSUMOS = [
  ins(1, { codigo: 'INS-COL-001', nombre: 'Collarín talla S', familia: 'Collarín cervical', familia_abrev: 'COL',
    especificaciones: 'Talla S adulto', ambulanciaId: 5, ambulancia: { codigo: 'AMB-05' }, observaciones: 'Revisar' }),
  ins(2, { codigo: null, nombre: 'Venda elástica', familia: 'Venda', familia_abrev: null, especificaciones: 'x'.repeat(45),
    fecha_creacion: null, createdAt: '2026-02-10T15:00:00Z', fecha_modificacion: null, updatedAt: 'no-es-fecha' }),
  ins(3, { codigo: 'INS-OXI-001', nombre: 'Bala de oxígeno', familia: null, ambulanciaId: 6, ambulancia: { codigo: 'AMB-06' },
    estado: 'baja', fecha_creacion: null, fecha_modificacion: null }),
];

let token;
const cabeceras = () => ({ Authorization: `Bearer ${token}` });
const fila = (nombre) => screen.getByText(nombre).closest('tr');
const enFila = (nombre, texto) => within(fila(nombre)).getByRole('button', { name: texto });
const modal = () => screen.getByRole('heading', { level: 2 }).parentElement;
const filasTabla = () => screen.getAllByRole('row').slice(1);
const buscador = () => screen.getByPlaceholderText('Buscar por nombre, código o especificación...');

async function montar({ rol = 'admin', insumos = INSUMOS, rutas = {}, cookies = {} } = {}) {
  token = rol === 'admin' ? jwtAdmin() : jwtAmbulancia();
  cookiesCon(Cookies, { token, ...cookies });
  rutasGet(axios, { '/api/insumos': insumos, '/api/ambulancias': AMBULANCIAS, ...rutas });
  const r = render(<InventarioPage />);
  if (insumos.length) await screen.findByText(insumos[0].nombre ?? insumos[0].codigo);
  else await screen.findByText('No hay insumos activos registrados.');
  return r;
}

beforeEach(() => {
  push.mockReset();
});

describe('inventario/page.js · acceso', () => {
  it('sin token va al login y no pide datos', () => {
    cookiesCon(Cookies, {});

    render(<InventarioPage />);

    expect(push).toHaveBeenCalledWith('/login');
    expect(axios.get).not.toHaveBeenCalled();
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it.each([
    ['token ilegible', 'roto'],
    ['token vencido', jwtAdmin({ exp: Math.floor(Date.now() / 1000) - 60 })],
  ])('con %s borra las cookies y va al login', (_c, t) => {
    cookiesCon(Cookies, { token: t });

    render(<InventarioPage />);

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(Cookies.remove).toHaveBeenCalledWith('usuario');
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('carga insumos y ambulancias con el token y muestra el usuario de la cookie', async () => {
    await montar({ cookies: { usuario: JSON.stringify({ nombre: 'Ana Admin', rol: 'admin' }) } });

    expect(axios.get).toHaveBeenCalledWith(`${API}/api/insumos`, { headers: cabeceras() });
    expect(axios.get).toHaveBeenCalledWith(`${API}/api/ambulancias`, { headers: cabeceras() });
    expect(screen.getByText('Ana Admin')).toBeInTheDocument();
  });

  it.each([['sin cookie usuario', undefined], ['con cookie usuario corrupta', '{x']])(
    '%s usa los datos del token',
    async (_c, usuario) => {
      await montar({ cookies: { usuario } });

      expect(screen.getByText('Administrador01')).toBeInTheDocument();
    },
  );

  it('el admin ve "Nuevo insumo" y las acciones solo en insumos activos', async () => {
    await montar();

    expect(screen.getByRole('button', { name: '+ Nuevo insumo' })).toBeInTheDocument();
    for (const n of ['Collarín talla S', 'Venda elástica']) {
      expect(within(fila(n)).getAllByRole('button').map((b) => b.textContent)).toEqual(['🔲 QR', '✏️', '🚑', 'Baja']);
    }
    expect(within(fila('Bala de oxígeno')).getAllByRole('button').map((b) => b.textContent)).toEqual(['🔲 QR']);
  });

  it('el rol ambulancia solo puede ver y generar QR', async () => {
    await montar({ rol: 'ambulancia' });

    expect(screen.getByText('Ambulancia01')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Nuevo insumo' })).not.toBeInTheDocument();
    expect(within(fila('Collarín talla S')).getAllByRole('button').map((b) => b.textContent)).toEqual(['🔲 QR']);
  });

  it('cerrar sesión borra las cookies y va al login', async () => {
    await montar();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(Cookies.remove).toHaveBeenCalledWith('usuario');
    expect(push).toHaveBeenCalledWith('/login');
  });
});

describe('inventario/page.js · tabla y filtros', () => {
  it('pinta cada columna con sus valores por defecto', async () => {
    await montar();
    const celdas = (n) => [...fila(n).querySelectorAll('td')].slice(0, 8).map((td) => td.textContent);

    expect(screen.getByText('3 de 3 unidades activas')).toBeInTheDocument();
    expect(celdas('Collarín talla S')).toEqual(
      ['INS-COL-001', 'Collarín talla S', 'COL', 'Talla S adulto', 'AMB-05', 'Activo', '01-02-2026', '03-02-2026']);
    // Sin código muestra el id; sin abreviatura, la familia; especificación larga recortada a 40 caracteres;
    // createdAt ISO se formatea en hora local (Bogotá) y una fecha inválida se muestra como "—"
    expect(celdas('Venda elástica')).toEqual(
      ['#2', 'Venda elástica', 'Venda', `${'x'.repeat(40)}…`, 'Sin asignar', 'Activo', '10-02-2026', '—']);
    expect(within(fila('Venda elástica')).getByTitle('x'.repeat(45))).toBeInTheDocument();
    expect(celdas('Bala de oxígeno')).toEqual(
      ['INS-OXI-001', 'Bala de oxígeno', '—', '—', 'AMB-06', 'Dado de baja', '—', '—']);
  });

  it('con un solo insumo usa el singular', async () => {
    await montar({ insumos: [INSUMOS[0]] });

    expect(screen.getByText('1 de 1 unidad activa')).toBeInTheDocument();
  });

  it('el hover cambia el fondo de la fila y lo restaura según su paridad', async () => {
    await montar();
    const par = fila('Collarín talla S');
    const impar = fila('Venda elástica');

    fireEvent.mouseEnter(par);
    expect(par.style.backgroundColor).toBe('rgb(232, 243, 237)');
    fireEvent.mouseLeave(par);
    expect(par.style.backgroundColor).toBe('rgb(255, 255, 255)');
    fireEvent.mouseLeave(impar);
    expect(impar.style.backgroundColor).toBe('rgb(250, 252, 251)');
  });

  it('si la carga falla muestra el error global; si fallan las ambulancias se ignora', async () => {
    token = jwtAdmin();
    cookiesCon(Cookies, { token });
    rutasGet(axios, { '/api/insumos': new Error('caída'), '/api/ambulancias': new Error('caída') });

    render(<InventarioPage />);

    expect(await screen.findByText('No se pudo cargar el inventario. Verifica la conexión con el servidor.')).toBeInTheDocument();
    expect(screen.getByText('No hay insumos activos registrados.')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')[1].options).toHaveLength(2);
  });

  it('las familias del filtro salen del inventario, sin repetir y ordenadas', async () => {
    await montar({ insumos: [...INSUMOS, ins(4, { familia: 'Venda' })] });

    expect([...screen.getAllByRole('combobox')[0].options].map((o) => o.value))
      .toEqual(['', 'Collarín cervical', 'Venda']);
    expect([...screen.getAllByRole('combobox')[1].options].map((o) => o.textContent))
      .toEqual(['Todas las ambulancias', 'Sin ambulancia', 'AMB-05', 'AMB-06']);
  });

  it.each([
    ['nombre', 'VENDA', ['Venda elástica']],
    ['código', 'oxi', ['Bala de oxígeno']],
    ['especificación', 'adulto', ['Collarín talla S']],
  ])('busca por %s sin distinguir mayúsculas', async (_c, texto, visibles) => {
    await montar();

    fireEvent.change(buscador(), { target: { value: texto } });

    expect(filasTabla().map((tr) => tr.querySelectorAll('td')[1].textContent)).toEqual(visibles);
    expect(screen.getByText(`${visibles.length} de 3 unidades activas`)).toBeInTheDocument();
  });

  it.each([
    ['familia', 0, 'Venda', ['Venda elástica']],
    ['sin ambulancia', 1, 'ninguna', ['Venda elástica']],
    ['ambulancia AMB-06', 1, '6', ['Bala de oxígeno']],
  ])('filtra por %s', async (_c, idx, valor, visibles) => {
    await montar();

    fireEvent.change(screen.getAllByRole('combobox')[idx], { target: { value: valor } });

    expect(filasTabla().map((tr) => tr.querySelectorAll('td')[1].textContent)).toEqual(visibles);
  });

  it('sin resultados avisa y "Limpiar filtros" lo restablece todo', async () => {
    await montar();
    const [fam, amb] = screen.getAllByRole('combobox');

    fireEvent.change(buscador(), { target: { value: 'zzz' } });
    fireEvent.change(fam, { target: { value: 'Venda' } });
    fireEvent.change(amb, { target: { value: '5' } });
    expect(screen.getByText('No se encontraron insumos con esos filtros.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '✕ Limpiar filtros' }));

    expect(buscador()).toHaveValue('');
    expect(fam).toHaveValue('');
    expect(amb).toHaveValue('');
    expect(filasTabla()).toHaveLength(3);
  });

  it('pagina de 5 en 5 y un filtro vuelve a mostrar solo 5', async () => {
    await montar({ insumos: Array.from({ length: 11 }, (_, i) => ins(i + 1)) });

    expect(filasTabla()).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (6 restantes)' }));
    expect(filasTabla()).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (1 restante)' }));
    expect(filasTabla()).toHaveLength(11);
    expect(screen.queryByRole('button', { name: /Ver más/ })).not.toBeInTheDocument();

    fireEvent.change(buscador(), { target: { value: 'insumo' } });
    expect(filasTabla()).toHaveLength(5);
  });
});

describe('inventario/page.js · crear insumo', () => {
  const abrir = async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo insumo' }));
    expect(screen.getByRole('heading', { name: 'Nuevo insumo' })).toBeInTheDocument();
  };

  it('el nombre es obligatorio', async () => {
    await abrir();

    fireEvent.click(screen.getByRole('button', { name: 'Crear insumo' }));

    expect(screen.getByText('El nombre es requerido')).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('la familia elegida cambia el formato del código y las ambulancias muestran su descripción', async () => {
    await abrir();
    const [familia, ambulancia] = within(modal()).getAllByRole('combobox');

    expect(within(modal()).getByText('INS-COL-###')).toBeInTheDocument();
    fireEvent.change(familia, { target: { value: '12' } });
    expect(within(modal()).getByText('INS-GEN-###')).toBeInTheDocument();
    expect([...ambulancia.options].map((o) => o.textContent))
      .toEqual(['— Sin ambulancia asignada —', 'AMB-05 — Básica', 'AMB-06']);
  });

  it('la cantidad va de 1 a 50 y cambia el texto del botón', async () => {
    await abrir();
    const menos = within(modal()).getByRole('button', { name: '−' });
    const mas = within(modal()).getByRole('button', { name: '+' });

    fireEvent.click(menos);
    expect(within(modal()).getByText('Un registro individual')).toBeInTheDocument();
    for (let i = 0; i < 60; i++) fireEvent.click(mas);
    expect(within(modal()).getByText('Se crearán 50 registros independientes')).toBeInTheDocument();
    fireEvent.click(menos);
    expect(screen.getByRole('button', { name: 'Crear 49 unidades' })).toBeInTheDocument();
  });

  it('crea con POST (opcionales vacíos como undefined), recarga y cierra', async () => {
    await abrir();
    let resolver;
    axios.post.mockReturnValue(new Promise((r) => { resolver = r; }));

    fireEvent.change(screen.getByPlaceholderText('Ej: Collar cervical talla S'), { target: { value: '  Venda 4"  ' } });
    fireEvent.change(within(modal()).getAllByRole('combobox')[0], { target: { value: '1' } });
    fireEvent.click(within(modal()).getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear 2 unidades' }));

    expect(await screen.findByRole('button', { name: 'Creando...' })).toBeDisabled();
    expect(axios.post).toHaveBeenCalledWith(`${API}/api/insumos`, {
      nombre: 'Venda 4"', familia: 'Venda', familia_abrev: 'VEN', especificaciones: undefined, ambulanciaId: undefined, cantidad: 2,
    }, { headers: cabeceras() });
    const [, body] = axios.post.mock.calls[0];
    expect(Object.keys(body).filter((k) => body[k] === undefined)).toEqual(['especificaciones', 'ambulanciaId']);

    resolver({ data: {} });

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Nuevo insumo' })).not.toBeInTheDocument());
    expect(axios.get.mock.calls.filter(([u]) => u === `${API}/api/insumos`)).toHaveLength(2);
  });

  it('envía especificaciones y ambulancia cuando se indican', async () => {
    await abrir();
    axios.post.mockResolvedValue({ data: {} });

    fireEvent.change(screen.getByPlaceholderText('Ej: Collar cervical talla S'), { target: { value: 'Collar' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Talla S, 4 pulgadas, adulto...'), { target: { value: ' Talla M ' } });
    fireEvent.change(within(modal()).getAllByRole('combobox')[1], { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear insumo' }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(`${API}/api/insumos`, expect.objectContaining({
      especificaciones: 'Talla M', ambulanciaId: '6', cantidad: 1,
    }), { headers: cabeceras() }));
  });

  it.each([
    [{ response: { data: { message: 'Familia inválida' } } }, 'Familia inválida'],
    [new Error('red'), 'Error al crear el insumo'],
  ])('si crear falla muestra el error y deja el modal (%#)', async (err, texto) => {
    await abrir();
    axios.post.mockRejectedValue(err);
    fireEvent.change(screen.getByPlaceholderText('Ej: Collar cervical talla S'), { target: { value: 'X' } });

    fireEvent.click(screen.getByRole('button', { name: 'Crear insumo' }));

    expect(await screen.findByText(texto)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear insumo' })).toBeEnabled();
  });

  it('Cancelar y el fondo cierran el modal; un clic dentro no', async () => {
    await abrir();

    fireEvent.click(screen.getByRole('heading', { name: 'Nuevo insumo' }));
    expect(screen.getByRole('heading', { name: 'Nuevo insumo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo insumo' }));
    fireEvent.click(modal().parentElement);
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });
});

describe('inventario/page.js · editar insumo', () => {
  it('precarga los datos y hace PUT; ambulancia vacía se envía como null', async () => {
    await montar();
    axios.put.mockResolvedValue({ data: {} });

    fireEvent.click(enFila('Collarín talla S', '✏️'));
    expect(within(modal()).getByText('INS-COL-001 · Collarín cervical')).toBeInTheDocument();
    const [nombre, espec] = modal().querySelectorAll('input');
    expect(nombre).toHaveValue('Collarín talla S');
    expect(espec).toHaveValue('Talla S adulto');
    expect(within(modal()).getByRole('combobox')).toHaveValue('5');
    expect(screen.getByPlaceholderText('Notas opcionales...')).toHaveValue('Revisar');

    fireEvent.change(within(modal()).getByRole('combobox'), { target: { value: '' } });
    fireEvent.change(screen.getByPlaceholderText('Notas opcionales...'), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(`${API}/api/insumos/1`, {
      nombre: 'Collarín talla S', especificaciones: 'Talla S adulto', ambulanciaId: null, observaciones: undefined,
    }, { headers: cabeceras() }));
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument());
  });

  it('sin código ni familia muestra el id y "—"; el nombre vacío no se envía', async () => {
    await montar({ insumos: [ins(9, { codigo: null, familia: null, especificaciones: null, nombre: 'Sin datos' })] });

    fireEvent.click(enFila('Sin datos', '✏️'));
    expect(within(modal()).getByText('#9 · —')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Talla, tamaño, modelo...')).toHaveValue('');
    expect(within(modal()).getByRole('combobox')).toHaveValue('');

    fireEvent.change(modal().querySelector('input'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(screen.getByText('El nombre no puede estar vacío')).toBeInTheDocument();
    expect(axios.put).not.toHaveBeenCalled();
  });

  it('un insumo sin nombre abre el formulario vacío', async () => {
    await montar({ insumos: [ins(9, { nombre: null, codigo: 'INS-X' })] });

    fireEvent.click(enFila('INS-X', '✏️'));

    expect(modal().querySelector('input')).toHaveValue('');
  });

  it.each([
    [{ response: { data: { message: 'No existe' } } }, 'No existe'],
    [new Error('red'), 'Error al guardar cambios'],
  ])('si el PUT falla muestra el error (%#)', async (err, texto) => {
    await montar();
    let rechazar;
    axios.put.mockReturnValue(new Promise((_r, j) => { rechazar = j; }));
    fireEvent.click(enFila('Venda elástica', '✏️'));

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('button', { name: 'Guardando...' })).toBeDisabled();
    rechazar(err);

    expect(await screen.findByText(texto)).toBeInTheDocument();
    expect(axios.put).toHaveBeenCalledWith(`${API}/api/insumos/2`, expect.objectContaining({
      especificaciones: 'x'.repeat(45), ambulanciaId: null,
    }), expect.anything());
  });

  it('Cancelar cierra el modal sin guardar', async () => {
    await montar();
    fireEvent.click(enFila('Collarín talla S', '✏️'));

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(axios.put).not.toHaveBeenCalled();
  });
});

describe('inventario/page.js · dar de baja', () => {
  const archivo = () => modal().querySelector('input[type="file"]');
  const foto = new File(['png'], 'evidencia.png', { type: 'image/png' });

  it('pide motivo y foto antes de enviar', async () => {
    await montar();
    fireEvent.click(enFila('Collarín talla S', 'Baja'));
    expect(within(modal()).getByText('INS-COL-001')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));
    expect(screen.getByText('El motivo de baja es requerido')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ej: Material vencido, daño físico irrecuperable...'), { target: { value: 'Vencido' } });
    fireEvent.change(archivo(), { target: { files: [] } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));
    expect(screen.getByText('La foto de evidencia es requerida')).toBeInTheDocument();
    expect(screen.queryByAltText('Evidencia')).not.toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('muestra la vista previa y envía FormData multipart con motivo y foto', async () => {
    await montar();
    const crearURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:evidencia');
    let resolver;
    axios.post.mockReturnValue(new Promise((r) => { resolver = r; }));
    fireEvent.click(enFila('Venda elástica', 'Baja'));
    expect(within(modal()).getByText('Venda elástica', { selector: 'strong' }).nextSibling).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Ej: Material vencido, daño físico irrecuperable...'), { target: { value: '  Roto  ' } });
    fireEvent.change(archivo(), { target: { files: [foto] } });
    expect(crearURL).toHaveBeenCalledWith(foto);
    expect(screen.getByAltText('Evidencia')).toHaveAttribute('src', 'blob:evidencia');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    expect(await screen.findByRole('button', { name: 'Procesando...' })).toBeDisabled();
    const [url, fd, config] = axios.post.mock.calls[0];
    expect(url).toBe(`${API}/api/insumos/2/baja`);
    expect(fd.get('motivo')).toBe('Roto');
    expect(fd.get('foto')).toBeInstanceOf(File);
    expect(fd.get('foto').name).toBe('evidencia.png');
    expect(config).toEqual({ headers: { ...cabeceras(), 'Content-Type': 'multipart/form-data' } });

    resolver({ data: {} });
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument());
  });

  it.each([
    [{ response: { data: { message: 'Solo se permiten imágenes' } } }, 'Solo se permiten imágenes'],
    [new Error('red'), 'Error al dar de baja'],
  ])('si la baja falla muestra el error (%#)', async (err, texto) => {
    await montar();
    axios.post.mockRejectedValue(err);
    fireEvent.click(enFila('Collarín talla S', 'Baja'));
    fireEvent.change(screen.getByPlaceholderText('Ej: Material vencido, daño físico irrecuperable...'), { target: { value: 'x' } });
    fireEvent.change(archivo(), { target: { files: [foto] } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    expect(await screen.findByText(texto)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar baja' })).toBeEnabled();
  });

  it('Cancelar cierra el modal', async () => {
    await montar();
    fireEvent.click(enFila('Collarín talla S', 'Baja'));

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });
});

describe('inventario/page.js · reasignar ambulancia', () => {
  it('permanente sin destino retira la ambulancia (null) y omite lo vacío', async () => {
    await montar();
    let resolver;
    axios.post.mockReturnValue(new Promise((r) => { resolver = r; }));
    fireEvent.click(enFila('Collarín talla S', '🚑'));
    expect(within(modal()).getByText('AMB-05', { selector: 'strong' })).toBeInTheDocument();
    expect(within(modal()).getByText('INS-COL-001')).toBeInTheDocument();
    expect([...within(modal()).getByRole('combobox').options].map((o) => o.textContent))
      .toEqual(['— Sin ambulancia (retirar) —', 'AMB-05 — Básica', 'AMB-06']);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reasignación' }));

    expect(await screen.findByRole('button', { name: 'Reasignando...' })).toBeDisabled();
    expect(axios.post).toHaveBeenCalledWith(`${API}/api/insumos/1/reasignar`, {
      ambulancia_nueva_id: null, tipo: 'permanente', notas: undefined, fecha_devolucion_esperada: undefined,
    }, { headers: cabeceras() });
    resolver({ data: {} });
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument());
  });

  it('el préstamo exige fecha de devolución y luego la envía con destino y notas', async () => {
    await montar();
    axios.post.mockResolvedValue({ data: {} });
    fireEvent.click(enFila('Venda elástica', '🚑'));
    expect(within(modal()).getByText('Sin ambulancia', { selector: 'strong' })).toBeInTheDocument();
    const prestamo = screen.getByRole('button', { name: 'Préstamo temporal' });

    expect(modal().querySelector('input[type="date"]')).toBeNull();
    fireEvent.click(prestamo);
    expect(prestamo).toHaveStyle({ color: 'rgb(45, 134, 83)' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reasignación' }));
    expect(screen.getByText('Indique la fecha de devolución esperada para el préstamo')).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();

    fireEvent.change(within(modal()).getByRole('combobox'), { target: { value: '6' } });
    fireEvent.change(modal().querySelector('input[type="date"]'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByPlaceholderText('Motivo del traslado, detalles...'), { target: { value: ' Apoyo ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reasignación' }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(`${API}/api/insumos/2/reasignar`, {
      ambulancia_nueva_id: '6', tipo: 'prestamo', notas: 'Apoyo', fecha_devolucion_esperada: '2026-12-01',
    }, { headers: cabeceras() }));
  });

  it('volver a "Permanente" oculta la fecha', async () => {
    await montar();
    fireEvent.click(enFila('Collarín talla S', '🚑'));

    fireEvent.click(screen.getByRole('button', { name: 'Préstamo temporal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Permanente' }));

    expect(modal().querySelector('input[type="date"]')).toBeNull();
  });

  it.each([
    [{ response: { data: { message: 'Ya está en esa ambulancia' } } }, 'Ya está en esa ambulancia'],
    [new Error('red'), 'Error al reasignar'],
  ])('si reasignar falla muestra el error (%#)', async (err, texto) => {
    await montar();
    axios.post.mockRejectedValue(err);
    fireEvent.click(enFila('Collarín talla S', '🚑'));

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reasignación' }));

    expect(await screen.findByText(texto)).toBeInTheDocument();
  });

  it('Cancelar cierra el modal', async () => {
    await montar();
    fireEvent.click(enFila('Collarín talla S', '🚑'));

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });
});

describe('inventario/page.js · accesibilidad', () => {
  it('los labels de los formularios están asociados a sus campos', async () => {
    await montar();

    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo insumo' }));
    expect(screen.getByLabelText('Nombre del insumo *')).toHaveAttribute('placeholder', 'Ej: Collar cervical talla S');
    expect(screen.getByLabelText('Familia *').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Ambulancia asignada').tagName).toBe('SELECT');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    fireEvent.click(enFila('Collarín talla S', '✏️'));
    expect(screen.getByLabelText('Nombre *')).toHaveValue('Collarín talla S');
    expect(screen.getByLabelText('Observaciones')).toHaveValue('Revisar');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    fireEvent.click(enFila('Collarín talla S', 'Baja'));
    expect(screen.getByLabelText('Foto de evidencia *')).toHaveAttribute('type', 'file');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    fireEvent.click(enFila('Collarín talla S', '🚑'));
    fireEvent.click(screen.getByRole('button', { name: 'Préstamo temporal' }));
    expect(screen.getByLabelText('Fecha de devolución esperada *')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Notas').tagName).toBe('TEXTAREA');
  });
});
