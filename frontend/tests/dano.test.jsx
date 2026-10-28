import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtAmbulancia, cookiesCon, rutasGet } from './helpers.js';

const push = vi.fn();
const router = { push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('js-cookie', () => ({ default: { get: vi.fn(), remove: vi.fn() } }));
vi.mock('../app/dashboard/_components/InsumoSelector', () => import('./InsumoSelector.stub.jsx'));

import DanoPage from '../app/dashboard/dano/page';

const AMBULANCIAS = [{ id: 5, codigo: 'AMB-05', descripcion: 'Básica' }, { id: 6, codigo: 'AMB-06' }];
const foto = (nombre) => new File(['contenido'], nombre, { type: 'image/jpeg' });

let token;
let contenedor;
const motivo = () => screen.getByPlaceholderText('Describe detalladamente qué ocurrió con el insumo...');
const inputFotos = () => contenedor.querySelector('input[type="file"]');
const fecha = () => contenedor.querySelector('input[type="date"]');
const hora = () => contenedor.querySelector('input[type="time"]');
const enviar = () => fireEvent.click(screen.getByRole('button', { name: /^Registrar|Enviando/ }));

async function montar({ ambulancias = AMBULANCIAS } = {}) {
  token = jwtAmbulancia();
  cookiesCon(Cookies, { token, usuario: JSON.stringify({ id: 2, nombre: 'Tripulación 01', rol: 'ambulancia' }) });
  rutasGet(axios, { '/api/ambulancias/activas': ambulancias });
  const r = render(<DanoPage />);
  contenedor = r.container;
  await screen.findByText('Reportar daño o pérdida');
  if (ambulancias.length) await screen.findByRole('option', { name: 'AMB-05 — Básica' });
  return r;
}

beforeEach(() => {
  push.mockReset();
  vi.spyOn(URL, 'createObjectURL').mockImplementation((f) => `blob:${f.name}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('dano/page.js · sesión', () => {
  it('sin token va al login', () => {
    cookiesCon(Cookies, {});

    render(<DanoPage />);

    expect(push).toHaveBeenCalledWith('/login');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('un token vencido borra las cookies y va al login', () => {
    cookiesCon(Cookies, { token: jwtAmbulancia({ exp: 1 }) });
    rutasGet(axios, { '/api/ambulancias/activas': [] });

    render(<DanoPage />);

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(push).toHaveBeenCalledWith('/login');
  });

  it.each([[undefined], ['{roto']])('con cookie usuario %j usa el token; sin ambulancias no muestra el selector', async (usuario) => {
    cookiesCon(Cookies, { token: jwtAmbulancia(), usuario });
    axios.get.mockRejectedValue(new Error('red'));

    render(<DanoPage />);

    expect(await screen.findByText('Ambulancia01')).toBeInTheDocument();
    expect(screen.queryByText('Seleccionar ambulancia...')).not.toBeInTheDocument();
  });
});

describe('dano/page.js · formulario', () => {
  it('a las 23:30 en Colombia propone la fecha de hoy y la hora actual', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-05T23:30:00-05:00') });
    await montar();

    expect(fecha()).toHaveValue('2026-10-05');
    expect(hora()).toHaveValue('23:30');
  });

  it('el tipo cambia entre daño y pérdida y el botón lo refleja', async () => {
    await montar();
    expect(screen.getByRole('button', { name: 'Registrar daño' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '🔍 Pérdida' }));

    expect(screen.getByRole('button', { name: 'Registrar pérdida' })).toBeInTheDocument();
  });

  it('elegir una ambulancia se pasa al selector de insumos; volver a "Seleccionar" la quita', async () => {
    await montar();
    const select = screen.getByRole('combobox');

    fireEvent.change(select, { target: { value: '6' } });
    expect(screen.getByTestId('insumo-selector')).toHaveAttribute('data-ambulancia', '6');
    fireEvent.focus(select);
    fireEvent.blur(select);

    fireEvent.change(select, { target: { value: '' } });
    expect(screen.getByTestId('insumo-selector')).toHaveAttribute('data-ambulancia', '');
  });

  it('el motivo tiene contador y no acepta más de 500 caracteres', async () => {
    await montar();

    fireEvent.change(motivo(), { target: { value: 'a'.repeat(460) } });
    expect(screen.getByText('460/500')).toHaveStyle({ color: 'rgb(45, 134, 83)' });

    fireEvent.change(motivo(), { target: { value: 'a'.repeat(501) } });
    expect(motivo()).toHaveValue('a'.repeat(460));
    expect(screen.getByText('460/500')).toBeInTheDocument();
  });

  it.each([
    ['sin insumo', () => {}, 'Debe buscar y seleccionar un insumo válido.'],
    ['sin motivo', () => fireEvent.click(screen.getByRole('button', { name: 'elegir insumo' })), 'El motivo es requerido.'],
    ['sin fecha', () => {
      fireEvent.click(screen.getByRole('button', { name: 'elegir insumo' }));
      fireEvent.change(motivo(), { target: { value: 'Roto' } });
      fireEvent.change(fecha(), { target: { value: '' } });
    }, 'La fecha es requerida.'],
    ['sin hora', () => {
      fireEvent.click(screen.getByRole('button', { name: 'elegir insumo' }));
      fireEvent.change(motivo(), { target: { value: 'Roto' } });
      fireEvent.change(hora(), { target: { value: '' } });
    }, 'La hora es requerida.'],
  ])('%s → error sin enviar', async (_c, preparar, mensaje) => {
    await montar();

    preparar();
    enviar();

    expect(screen.getByText(mensaje)).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('dano/page.js · fotos de evidencia', () => {
  it('agrega fotos con vista previa (máx. 5) y permite quitarlas', async () => {
    const user = userEvent.setup();
    await montar();

    await user.upload(inputFotos(), [foto('a.jpg'), foto('b.jpg')]);
    expect(screen.getByRole('img', { name: 'Evidencia 1' })).toHaveAttribute('src', 'blob:a.jpg');
    expect(screen.getByText('2/5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agregar más fotos/ })).toBeInTheDocument();

    await user.upload(inputFotos(), [foto('c.jpg'), foto('d.jpg'), foto('e.jpg'), foto('f.jpg')]);
    expect(screen.getAllByRole('img')).toHaveLength(5);
    expect(screen.getByText('5/5')).toBeInTheDocument();
    // Al llegar al máximo ya no se ofrece agregar más
    expect(inputFotos()).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: '✕' })[0]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a.jpg');
    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.getByRole('img', { name: 'Evidencia 1' })).toHaveAttribute('src', 'blob:b.jpg');
  });

  it('el botón "Agregar fotos" abre el selector de archivos; sin archivos no cambia nada', async () => {
    await montar();
    const click = vi.spyOn(inputFotos(), 'click');

    fireEvent.click(screen.getByRole('button', { name: /Agregar fotos/ }));
    fireEvent.change(inputFotos(), { target: { files: [] } });

    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByText('0/5')).toBeInTheDocument();
  });

  // BUG: el efecto `useEffect(() => () => previews.forEach(revokeObjectURL), [previews])` se limpia
  // cada vez que cambia la lista, así que al agregar una foto se revocan las URL de las anteriores,
  // que siguen en pantalla: sus vistas previas dejan de verse en el navegador.
  it('agregar una segunda foto no invalida la vista previa de la primera', async () => {
    const user = userEvent.setup();
    await montar();

    await user.upload(inputFotos(), [foto('a.jpg')]);
    await user.upload(inputFotos(), [foto('b.jpg')]);

    expect(screen.getByRole('img', { name: 'Evidencia 1' })).toHaveAttribute('src', 'blob:a.jpg');
    expect(screen.getByRole('img', { name: 'Evidencia 2' })).toHaveAttribute('src', 'blob:b.jpg');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('al salir de la página libera las vistas previas que quedaron abiertas', async () => {
    const user = userEvent.setup();
    const { unmount } = await montar();
    await user.upload(inputFotos(), [foto('a.jpg'), foto('b.jpg')]);

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a.jpg');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:b.jpg');
  });
});

describe('dano/page.js · envío', () => {
  it('envía multipart con tipo, código, motivo, fecha, hora y fotos; luego limpia y oculta el aviso', async () => {
    axios.post.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    await montar();
    fireEvent.click(screen.getByRole('button', { name: '🔍 Pérdida' }));
    fireEvent.click(screen.getByRole('button', { name: 'elegir insumo' }));
    fireEvent.change(motivo(), { target: { value: '  Se cayó en la vía  ' } });
    fireEvent.change(fecha(), { target: { value: '2026-10-05' } });
    fireEvent.change(hora(), { target: { value: '09:15' } });
    const archivos = [foto('a.jpg'), foto('b.jpg')];
    await user.upload(inputFotos(), archivos);
    vi.useFakeTimers();

    await act(async () => { enviar(); });

    expect(screen.getByText('✓ Reporte registrado exitosamente')).toBeInTheDocument();
    const [url, fd, opciones] = axios.post.mock.calls[0];
    expect(url).toBe('http://localhost:4000/api/movimientos/dano-perdida');
    expect(opciones).toEqual({ headers: { Authorization: `Bearer ${token}` } });
    expect(fd).toBeInstanceOf(FormData);
    expect(fd.get('tipo')).toBe('perdida');
    expect(fd.get('codigoInsumo')).toBe('INS-COL-001');
    expect(fd.get('motivo')).toBe('Se cayó en la vía');
    expect(fd.get('fecha')).toBe('2026-10-05');
    expect(fd.get('hora')).toBe('09:15');
    expect(fd.getAll('fotos').map((f) => f.name)).toEqual(['a.jpg', 'b.jpg']);
    // Formulario reiniciado
    expect(motivo()).toHaveValue('');
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Registrar daño' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText('✓ Reporte registrado exitosamente')).not.toBeInTheDocument();
  });

  it('un insumo sin código se envía con código vacío', async () => {
    axios.post.mockResolvedValue({ data: {} });
    await montar({ ambulancias: [] });
    fireEvent.click(screen.getByRole('button', { name: 'elegir insumo sin código' }));
    fireEvent.change(motivo(), { target: { value: 'Roto' } });

    enviar();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(axios.post.mock.calls[0][1].get('codigoInsumo')).toBe('');
  });

  it.each([
    [{ response: { data: { message: 'El motivo es requerido' } } }, 'El motivo es requerido'],
    [new Error('red'), 'Error al registrar el reporte. Intente nuevamente.'],
  ])('muestra el error del servidor (%#)', async (fallo, mensaje) => {
    axios.post.mockRejectedValue(fallo);
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'elegir insumo' }));
    fireEvent.change(motivo(), { target: { value: 'Roto' } });

    enviar();

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
  });

  it('mientras envía muestra "Enviando..." deshabilitado; el hover solo actúa si no está enviando', async () => {
    axios.post.mockReturnValue(new Promise(() => {}));
    await montar();
    fireEvent.click(screen.getByRole('button', { name: 'elegir insumo' }));
    fireEvent.change(motivo(), { target: { value: 'Roto' } });
    const boton = screen.getByRole('button', { name: 'Registrar daño' });
    fireEvent.mouseEnter(boton);
    expect(boton.style.backgroundColor).toBe('rgb(74, 158, 110)');
    fireEvent.mouseLeave(boton);
    expect(boton.style.backgroundColor).toBe('rgb(45, 134, 83)');
    fireEvent.focus(motivo());
    expect(motivo().style.boxShadow).toBe('0 0 0 3px rgba(45,134,83,0.15)');
    fireEvent.blur(motivo());

    enviar();

    expect(await screen.findByRole('button', { name: 'Enviando...' })).toBeDisabled();
    fireEvent.mouseEnter(boton);
    fireEvent.mouseLeave(boton);
    expect(boton.style.backgroundColor).toBe('rgb(157, 201, 179)');
  });
});
