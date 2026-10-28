import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtAdmin, jwtAmbulancia, cookiesCon, rutasGet } from './helpers.js';

const push = vi.fn();
const router = { push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));
vi.mock('js-cookie', () => ({ default: { get: vi.fn(), remove: vi.fn() } }));

import AmbulanciasPage from '../app/dashboard/ambulancias/page';

const URL_TODAS = 'http://localhost:4000/api/ambulancias/todas';
const amb = (id, extra = {}) => ({ id, codigo: `AMB-0${id}`, placa: `PLA-00${id}`, descripcion: `Zona ${id}`, activa: true, ...extra });
const AMBULANCIAS = [
  amb(1, { descripcion: 'Básica zona norte' }),
  amb(2, { placa: null, descripcion: null }),
  amb(3, { activa: false, placa: 'XYZ-999' }),
];

let token;
const cabeceras = () => ({ headers: { Authorization: `Bearer ${token}` } });
const fila = (codigo) => screen.getByText(codigo).closest('tr');

async function montar(lista = AMBULANCIAS, cookies = {}) {
  token = jwtAdmin();
  cookiesCon(Cookies, { token, ...cookies });
  rutasGet(axios, { '/api/ambulancias/todas': lista });
  const r = render(<AmbulanciasPage />);
  if (lista.length) await screen.findByText(lista[0].codigo);
  else await screen.findByText('No hay ambulancias registradas.');
  return r;
}

beforeEach(() => {
  push.mockReset();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('ambulancias/page.js · acceso', () => {
  it('sin token va al login y no pide datos', () => {
    cookiesCon(Cookies, {});

    render(<AmbulanciasPage />);

    expect(push).toHaveBeenCalledWith('/login');
    expect(axios.get).not.toHaveBeenCalled();
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it.each([
    ['token ilegible', 'abc'],
    ['token vencido', jwtAdmin({ exp: Math.floor(Date.now() / 1000) - 10 })],
  ])('con %s borra las cookies y va al login', (_c, t) => {
    cookiesCon(Cookies, { token: t });

    render(<AmbulanciasPage />);

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(Cookies.remove).toHaveBeenCalledWith('usuario');
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('el rol ambulancia se manda al dashboard', () => {
    cookiesCon(Cookies, { token: jwtAmbulancia() });

    render(<AmbulanciasPage />);

    expect(push).toHaveBeenCalledWith('/dashboard');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('muestra el nombre de la cookie usuario', async () => {
    await montar(AMBULANCIAS, { usuario: JSON.stringify({ nombre: 'Ana Admin', rol: 'admin' }) });

    expect(screen.getByText('Ana Admin')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it.each([['sin cookie usuario', undefined], ['con cookie usuario corrupta', '{no-json']])(
    '%s usa los datos del token',
    async (_c, usuario) => {
      await montar(AMBULANCIAS, { usuario });

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

describe('ambulancias/page.js · listado y filtros', () => {
  it('pide /todas con el token y pinta cada columna', async () => {
    await montar();

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(URL_TODAS, cabeceras());
    expect(screen.getByText('3 de 3 ambulancia(s) registrada(s)')).toBeInTheDocument();
    expect(screen.getByText('3 resultado(s) ·', { exact: false })).toHaveTextContent('3 resultado(s) · 2 activa(s)');

    const f1 = fila('AMB-01');
    expect(f1).toHaveTextContent('PLA-001');
    expect(f1).toHaveTextContent('Básica zona norte');
    expect(f1).toHaveTextContent('Activa');
    expect(f1).toHaveTextContent('Desactivar');

    const f2 = fila('AMB-02');
    expect(f2.querySelectorAll('td')[1]).toHaveTextContent('—');
    expect(f2.querySelectorAll('td')[2]).toHaveTextContent('—');

    const f3 = fila('AMB-03');
    expect(f3).toHaveTextContent('Inactiva');
    expect(f3).toHaveTextContent('Activar');
    expect(screen.queryByRole('button', { name: /Ver más/ })).not.toBeInTheDocument();
  });

  it('el hover cambia el fondo de la fila y lo restaura según su paridad', async () => {
    await montar();
    const par = fila('AMB-01');
    const impar = fila('AMB-02');

    fireEvent.mouseEnter(par);
    expect(par.style.backgroundColor).toBe('rgb(232, 242, 248)');
    fireEvent.mouseLeave(par);
    expect(par.style.backgroundColor).toBe('rgb(255, 255, 255)');
    fireEvent.mouseLeave(impar);
    expect(impar.style.backgroundColor).toBe('rgb(248, 251, 253)');
  });

  it('si la carga falla muestra el error global', async () => {
    token = jwtAdmin();
    cookiesCon(Cookies, { token });
    rutasGet(axios, { '/api/ambulancias/todas': new Error('caída') });

    render(<AmbulanciasPage />);

    expect(await screen.findByText('No se pudo cargar la lista de ambulancias.')).toBeInTheDocument();
    expect(screen.getByText('No hay ambulancias registradas.')).toBeInTheDocument();
  });

  it('lista vacía muestra el mensaje sin filtros', async () => {
    await montar([]);

    expect(screen.getByText('0 de 0 ambulancia(s) registrada(s)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Limpiar/ })).not.toBeInTheDocument();
  });

  it.each([
    ['código', 'amb-02', ['AMB-02']],
    ['placa', 'xyz', ['AMB-03']],
    ['descripción', 'NORTE', ['AMB-01']],
  ])('busca por %s sin distinguir mayúsculas', async (_c, texto, visibles) => {
    await montar();

    fireEvent.change(screen.getByPlaceholderText('Buscar por código, placa o descripción...'), { target: { value: texto } });

    for (const a of AMBULANCIAS) {
      if (visibles.includes(a.codigo)) expect(screen.getByText(a.codigo)).toBeInTheDocument();
      else expect(screen.queryByText(a.codigo)).not.toBeInTheDocument();
    }
    expect(screen.getByText(`${visibles.length} de 3 ambulancia(s) registrada(s)`)).toBeInTheDocument();
  });

  it.each([
    ['true', ['AMB-01', 'AMB-02']],
    ['false', ['AMB-03']],
  ])('filtra por estado=%s', async (estado, visibles) => {
    await montar();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: estado } });

    for (const a of AMBULANCIAS) {
      if (visibles.includes(a.codigo)) expect(screen.getByText(a.codigo)).toBeInTheDocument();
      else expect(screen.queryByText(a.codigo)).not.toBeInTheDocument();
    }
  });

  it('sin resultados muestra el mensaje de filtros y Limpiar lo restablece todo', async () => {
    await montar();
    const buscador = screen.getByPlaceholderText('Buscar por código, placa o descripción...');

    fireEvent.change(buscador, { target: { value: 'no-existe' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'false' } });
    expect(screen.getByText('No se encontraron ambulancias con esos filtros.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '✕ Limpiar' }));

    expect(buscador).toHaveValue('');
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.getByText('3 de 3 ambulancia(s) registrada(s)')).toBeInTheDocument();
  });

  it('pagina de 5 en 5 con "Ver más" y el plural correcto', async () => {
    const muchas = Array.from({ length: 11 }, (_, i) => amb(i + 1, { codigo: `M-${i + 1}` }));
    await montar(muchas);

    expect(screen.getAllByRole('row')).toHaveLength(1 + 5);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (6 restantes)' }));
    expect(screen.getAllByRole('row')).toHaveLength(1 + 10);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (1 restante)' }));
    expect(screen.getAllByRole('row')).toHaveLength(1 + 11);
    expect(screen.queryByRole('button', { name: /Ver más/ })).not.toBeInTheDocument();
  });

  it('cambiar un filtro vuelve a mostrar solo 5', async () => {
    const muchas = Array.from({ length: 11 }, (_, i) => amb(i + 1, { codigo: `M-${i + 1}` }));
    await montar(muchas);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (6 restantes)' }));

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'true' } });

    expect(screen.getAllByRole('row')).toHaveLength(1 + 5);
  });
});

describe('ambulancias/page.js · crear y editar', () => {
  const campo = (ph) => screen.getByPlaceholderText(ph);

  it('valida código y placa obligatorios sin llamar al backend', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: '+ Nueva ambulancia' }));
    expect(screen.getByRole('heading', { name: 'Nueva ambulancia' })).toBeInTheDocument();

    fireEvent.change(campo('AMB-21'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByText('El código es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('La placa es obligatoria')).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('crea con datos recortados, placa en mayúsculas y descripción null; luego recarga y cierra', async () => {
    await montar();
    let resolver;
    axios.post.mockReturnValue(new Promise((r) => { resolver = r; }));
    fireEvent.click(screen.getByRole('button', { name: '+ Nueva ambulancia' }));

    fireEvent.change(campo('AMB-21'), { target: { value: ' AMB-21 ' } });
    fireEvent.change(campo('Ej: ABC-123'), { target: { value: ' abc-123 ' } });
    fireEvent.change(campo('Ej: Ambulancia básica zona norte'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('button', { name: 'Guardando...' })).toBeDisabled();
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:4000/api/ambulancias',
      { codigo: 'AMB-21', placa: 'ABC-123', descripcion: null },
      cabeceras(),
    );

    resolver({ data: {} });

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Nueva ambulancia' })).not.toBeInTheDocument());
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('editar precarga los datos y hace PUT con la descripción', async () => {
    await montar();
    axios.put.mockResolvedValue({ data: {} });

    fireEvent.click(fila('AMB-01').querySelector('button'));
    expect(screen.getByRole('heading', { name: 'Editar: AMB-01' })).toBeInTheDocument();
    expect(campo('AMB-21')).toHaveValue('AMB-01');
    expect(campo('Ej: ABC-123')).toHaveValue('PLA-001');
    expect(campo('Ej: Ambulancia básica zona norte')).toHaveValue('Básica zona norte');

    fireEvent.change(campo('Ej: Ambulancia básica zona norte'), { target: { value: ' Medicalizada ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(axios.put).toHaveBeenCalledWith(
      'http://localhost:4000/api/ambulancias/1',
      { codigo: 'AMB-01', placa: 'PLA-001', descripcion: 'Medicalizada' },
      cabeceras(),
    ));
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument());
  });

  it('editar una ambulancia sin placa ni descripción deja los campos vacíos', async () => {
    await montar();

    fireEvent.click(fila('AMB-02').querySelector('button'));

    expect(campo('Ej: ABC-123')).toHaveValue('');
    expect(campo('Ej: Ambulancia básica zona norte')).toHaveValue('');
  });

  it.each([
    ['con el mensaje del backend', { response: { data: { message: 'El código ya existe' } } }, 'El código ya existe'],
    ['con mensaje por defecto', new Error('red'), 'Error al guardar la ambulancia'],
  ])('si guardar falla muestra el error %s y deja el modal abierto', async (_c, err, texto) => {
    await montar();
    axios.put.mockRejectedValue(err);
    fireEvent.click(fila('AMB-01').querySelector('button'));

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(texto)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('Cancelar y el fondo cierran el modal; clic dentro no', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: '+ Nueva ambulancia' }));
    const titulo = screen.getByRole('heading', { name: 'Nueva ambulancia' });

    fireEvent.click(titulo);
    expect(titulo).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('heading', { name: 'Nueva ambulancia' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Nueva ambulancia' }));
    fireEvent.click(screen.getByRole('heading', { name: 'Nueva ambulancia' }).parentElement.parentElement);
    expect(screen.queryByRole('heading', { name: 'Nueva ambulancia' })).not.toBeInTheDocument();
  });
});

describe('ambulancias/page.js · activar, desactivar y eliminar', () => {
  it.each([
    ['AMB-01', 'Desactivar', '¿Desactivar la ambulancia "AMB-01"?', 1],
    ['AMB-03', 'Activar', '¿Activar la ambulancia "AMB-03"?', 3],
  ])('%s: %s pide confirmación, hace PATCH y recarga', async (codigo, boton, pregunta, id) => {
    await montar();
    axios.patch.mockResolvedValue({ data: {} });

    fireEvent.click(screen.getAllByRole('button', { name: boton }).find((b) => fila(codigo).contains(b)));

    expect(window.confirm).toHaveBeenCalledWith(pregunta);
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(axios.patch).toHaveBeenCalledWith(`http://localhost:4000/api/ambulancias/${id}/toggle`, {}, cabeceras());
  });

  it('si se cancela la confirmación no cambia el estado', async () => {
    await montar();
    window.confirm.mockReturnValue(false);

    fireEvent.click(fila('AMB-01').querySelectorAll('button')[1]);

    expect(axios.patch).not.toHaveBeenCalled();
  });

  it.each([
    ['AMB-01', { response: { data: { message: 'Tiene insumos' } } }, 'Tiene insumos'],
    ['AMB-01', new Error('red'), 'Error al desactivar la ambulancia'],
    ['AMB-03', new Error('red'), 'Error al activar la ambulancia'],
  ])('%s: si el PATCH falla avisa con alert (%#)', async (codigo, err, texto) => {
    await montar();
    axios.patch.mockRejectedValue(err);

    fireEvent.click(fila(codigo).querySelectorAll('button')[1]);

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(texto));
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('eliminar confirma con advertencia, hace DELETE y recarga', async () => {
    await montar();
    axios.delete.mockResolvedValue({ data: {} });

    fireEvent.click(fila('AMB-02').querySelectorAll('button')[2]);

    expect(window.confirm).toHaveBeenCalledWith('¿Eliminar permanentemente la ambulancia "AMB-02"?\nEsta acción no se puede deshacer.');
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(axios.delete).toHaveBeenCalledWith('http://localhost:4000/api/ambulancias/2', cabeceras());
  });

  it('eliminar cancelado no llama al backend', async () => {
    await montar();
    window.confirm.mockReturnValue(false);

    fireEvent.click(fila('AMB-02').querySelectorAll('button')[2]);

    expect(axios.delete).not.toHaveBeenCalled();
  });

  it.each([
    [{ response: { data: { message: 'Tiene movimientos' } } }, 'Tiene movimientos'],
    [new Error('red'), 'Error al eliminar la ambulancia'],
  ])('si eliminar falla avisa con alert: %s', async (err, texto) => {
    await montar();
    axios.delete.mockRejectedValue(err);

    fireEvent.click(fila('AMB-02').querySelectorAll('button')[2]);

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(texto));
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});

describe('ambulancias/page.js · accesibilidad', () => {
  it('los labels del formulario están asociados a sus campos', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: '+ Nueva ambulancia' }));

    expect(screen.getByLabelText('Código *')).toHaveAttribute('placeholder', 'AMB-21');
    expect(screen.getByLabelText('Placa *')).toHaveAttribute('placeholder', 'Ej: ABC-123');
    expect(screen.getByLabelText('Descripción')).toHaveAttribute('placeholder', 'Ej: Ambulancia básica zona norte');
  });
});
