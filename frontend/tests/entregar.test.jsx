import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

import EntregarInsumoPage from '../app/dashboard/entregar/page';

const CENTROS = [
  { id: 1, nombre: 'Hospital General', esOtro: false },
  { id: 99, nombre: 'Otro', esOtro: true },
];
const AMBULANCIAS = [
  { id: 5, codigo: 'AMB-05', descripcion: 'Básica' },
  { id: 6, codigo: 'AMB-06', descripcion: null },
];

let token;
let contenedor;
const campo = (name) => contenedor.querySelector(`[name="${name}"]`);
const escribir = (name, value) => fireEvent.change(campo(name), { target: { name, value } });
const guardar = () => fireEvent.click(screen.getByRole('button', { name: /Guardar entrega|Guardando/ }));

async function montar({ ambulancias = AMBULANCIAS } = {}) {
  token = jwtAmbulancia();
  cookiesCon(Cookies, { token, usuario: JSON.stringify({ id: 2, nombre: 'Tripulación 01', rol: 'ambulancia' }) });
  rutasGet(axios, { '/api/centros-asistenciales': CENTROS, '/api/ambulancias/activas': ambulancias });
  ({ container: contenedor } = render(<EntregarInsumoPage />));
  await screen.findByRole('option', { name: 'Hospital General' });
}

function llenarValido() {
  fireEvent.click(screen.getByRole('button', { name: 'elegir insumo' }));
  escribir('nombrePaciente', 'Paciente Prueba');
  escribir('historiaClinica', 'HC-123');
  escribir('centroAsistencialId', '1');
}

beforeEach(() => {
  push.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('entregar/page.js · sesión y carga inicial', () => {
  it('sin token va al login', () => {
    cookiesCon(Cookies, {});
    rutasGet(axios, { '/api/centros-asistenciales': [] });

    render(<EntregarInsumoPage />);

    expect(push).toHaveBeenCalledWith('/login');
  });

  it('un token vencido borra las cookies y va al login', () => {
    cookiesCon(Cookies, { token: jwtAmbulancia({ exp: 1 }) });
    rutasGet(axios, { '/api/centros-asistenciales': [] });

    render(<EntregarInsumoPage />);

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(push).toHaveBeenCalledWith('/login');
  });

  it.each([[undefined], ['{roto']])('con cookie usuario %j usa el número de ambulancia del token', async (usuario) => {
    cookiesCon(Cookies, { token: jwtAmbulancia(), usuario });
    rutasGet(axios, { '/api/centros-asistenciales': [], '/api/ambulancias/activas': [] });

    render(<EntregarInsumoPage />);

    expect(await screen.findByText('Ambulancia01')).toBeInTheDocument();
  });

  it('carga centros (sin token) y ambulancias activas (con token)', async () => {
    await montar();

    expect(axios.get).toHaveBeenCalledWith('http://localhost:4000/api/centros-asistenciales');
    expect(axios.get).toHaveBeenCalledWith('http://localhost:4000/api/ambulancias/activas', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(screen.getByRole('option', { name: 'AMB-05 — Básica' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'AMB-06' })).toBeInTheDocument();
    expect(screen.getByText('Tripulación 01')).toBeInTheDocument();
  });

  it('si fallan las listas la página sigue usable y la tripulación es texto libre', async () => {
    cookiesCon(Cookies, { token: jwtAmbulancia() });
    axios.get.mockRejectedValue(new Error('red'));
    const { container } = render(<EntregarInsumoPage />);

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(container.querySelector('input[name="tripulacion"]')).toHaveAttribute('placeholder', 'Ej: AMB-01');
  });

  it('propone la fecha de hoy y la hora actual', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-05T14:07:00-05:00') });
    await montar();

    expect(campo('fecha')).toHaveValue('2026-10-05');
    expect(campo('hora')).toHaveValue('14:07');
  });

  // Antes getHoy() usaba toISOString() (UTC): desde las 19:00 en Colombia proponía la fecha de mañana
  it('a las 23:30 en Colombia propone la fecha de hoy, no la de mañana', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-05T23:30:00-05:00') });
    await montar();

    expect(campo('hora')).toHaveValue('23:30');
    expect(campo('fecha')).toHaveValue('2026-10-05');
  });
});

describe('entregar/page.js · validaciones del formulario', () => {
  it.each([
    ['sin insumo', () => {}, 'Debe buscar y seleccionar un insumo válido.'],
    ['sin paciente', () => fireEvent.click(screen.getByRole('button', { name: 'elegir insumo' })), 'El nombre del paciente es requerido.'],
    ['sin historia clínica', () => {
      fireEvent.click(screen.getByRole('button', { name: 'elegir insumo' }));
      escribir('nombrePaciente', 'P');
    }, 'El número de historia clínica es requerido.'],
    ['sin centro', () => {
      fireEvent.click(screen.getByRole('button', { name: 'elegir insumo' }));
      escribir('nombrePaciente', 'P');
      escribir('historiaClinica', 'H');
    }, 'Debe seleccionar un centro asistencial.'],
    ['centro "Otro" sin nombre', () => { llenarValido(); escribir('centroAsistencialId', '99'); }, 'Por favor especifica el nombre del centro asistencial.'],
    ['sin fecha', () => { llenarValido(); escribir('fecha', ''); }, 'La fecha es requerida.'],
    ['sin hora', () => { llenarValido(); escribir('hora', ''); }, 'La hora es requerida.'],
  ])('%s → muestra el error y no envía', async (_caso, preparar, mensaje) => {
    await montar();

    preparar();
    guardar();

    expect(screen.getByText(mensaje)).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('un insumo sin código cuenta como no seleccionado', async () => {
    await montar();
    llenarValido();
    fireEvent.click(screen.getByRole('button', { name: 'elegir insumo sin código' }));

    guardar();

    expect(screen.getByText('Debe buscar y seleccionar un insumo válido.')).toBeInTheDocument();
  });

  it('al limpiar el insumo se exige de nuevo', async () => {
    await montar();
    llenarValido();
    fireEvent.click(screen.getByRole('button', { name: 'limpiar insumo' }));

    guardar();

    expect(screen.getByText('Debe buscar y seleccionar un insumo válido.')).toBeInTheDocument();
  });

  it('el centro "Otro" muestra el campo para escribir cuál', async () => {
    await montar();
    expect(campo('centroOtro')).toBeNull();

    escribir('centroAsistencialId', '99');

    expect(screen.getByPlaceholderText('Nombre del centro asistencial')).toBeInTheDocument();
  });
});

describe('entregar/page.js · envío', () => {
  it('envía la entrega con la tripulación combinada, muestra éxito y limpia el formulario', async () => {
    axios.post.mockResolvedValue({ data: {} });
    await montar();
    llenarValido();
    escribir('centroAsistencialId', '99');
    escribir('centroOtro', 'Clínica X');
    fireEvent.change(campo('tripulacion'), { target: { value: 'AMB-05' } });
    escribir('tripulantes', 'Juan, María');
    escribir('nombreMedico', 'Dra. Ruiz');
    expect(screen.getByTestId('insumo-selector')).toHaveAttribute('data-ambulancia', '5');

    guardar();

    expect(await screen.findByText('✓ Insumo registrado exitosamente')).toBeInTheDocument();
    const [url, cuerpo, opciones] = axios.post.mock.calls[0];
    expect(url).toBe('http://localhost:4000/api/movimientos/entrega');
    expect(cuerpo).toMatchObject({
      codigoInsumo: 'INS-COL-001',
      nombrePaciente: 'Paciente Prueba',
      historiaClinica: 'HC-123',
      centroAsistencialId: '99',
      centroOtro: 'Clínica X',
      tripulacion: 'AMB-05 — Juan, María',
      nombreMedico: 'Dra. Ruiz',
    });
    expect(cuerpo).not.toHaveProperty('tripulantes');
    expect(opciones).toEqual({ headers: { Authorization: `Bearer ${token}` } });
    expect(campo('nombrePaciente')).toHaveValue('');
    expect(screen.getByTestId('insumo-selector')).toHaveAttribute('data-ambulancia', '');
  });

  it('el aviso de éxito desaparece a los 4 segundos', async () => {
    axios.post.mockResolvedValue({ data: {} });
    await montar();
    llenarValido();
    vi.useFakeTimers();

    await act(async () => { guardar(); });
    expect(screen.getByText('✓ Insumo registrado exitosamente')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText('✓ Insumo registrado exitosamente')).not.toBeInTheDocument();
  });

  it('sin tripulantes envía solo la ambulancia; una ambulancia desconocida no se asocia', async () => {
    axios.post.mockResolvedValue({ data: {} });
    await montar();
    llenarValido();
    fireEvent.change(campo('tripulacion'), { target: { value: 'AMB-06' } });
    fireEvent.change(campo('tripulacion'), { target: { value: '' } });
    expect(screen.getByTestId('insumo-selector')).toHaveAttribute('data-ambulancia', '');

    guardar();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(axios.post.mock.calls[0][1].tripulacion).toBe('');
  });

  it('con tripulación en texto libre la envía tal cual', async () => {
    axios.post.mockResolvedValue({ data: {} });
    await montar({ ambulancias: [] });
    llenarValido();
    escribir('tripulacion', 'Móvil 7');

    guardar();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(axios.post.mock.calls[0][1].tripulacion).toBe('Móvil 7');
  });

  it('mientras guarda deshabilita el botón; el hover solo actúa si no está guardando', async () => {
    axios.post.mockReturnValue(new Promise(() => {}));
    await montar();
    llenarValido();
    const boton = screen.getByRole('button', { name: 'Guardar entrega' });
    fireEvent.mouseEnter(boton);
    expect(boton.style.backgroundColor).toBe('rgb(74, 158, 110)');
    fireEvent.mouseLeave(boton);
    expect(boton.style.backgroundColor).toBe('rgb(45, 134, 83)');

    guardar();

    expect(await screen.findByRole('button', { name: 'Guardando...' })).toBeDisabled();
    fireEvent.mouseEnter(boton);
    fireEvent.mouseLeave(boton);
    expect(boton.style.backgroundColor).toBe('rgb(157, 201, 179)');
  });

  it.each([
    [{ response: { data: { message: 'Insumo no encontrado con ese código' } } }, 'Insumo no encontrado con ese código'],
    [new Error('red'), 'Error al registrar la entrega. Intente nuevamente.'],
  ])('si el servidor rechaza muestra el error (%#)', async (fallo, mensaje) => {
    axios.post.mockRejectedValue(fallo);
    await montar();
    llenarValido();

    guardar();

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar entrega' })).toBeEnabled();
  });

  it('los campos se resaltan con el foco', async () => {
    await montar();

    fireEvent.focus(campo('nombrePaciente'));
    expect(campo('nombrePaciente').style.boxShadow).toBe('0 0 0 3px rgba(45,134,83,0.15)');
    fireEvent.blur(campo('nombrePaciente'));
    expect(campo('nombrePaciente').style.boxShadow).toBe('none');
  });
});
