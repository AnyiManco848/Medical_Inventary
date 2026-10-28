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

import RecogerPage from '../app/dashboard/recoger/page';

const CENTROS = [
  { id: 1, nombre: 'Hospital General', esOtro: false },
  { id: 99, nombre: 'Otro', esOtro: true },
];
const AMBULANCIAS = [{ id: 5, codigo: 'AMB-05', descripcion: 'Básica' }];
const ULTIMA = {
  nombrePaciente: 'Paciente Anterior', historiaClinica: 'HC-9', centroAsistencialId: 99,
  centroOtro: 'Clínica X', nombreMedico: 'Dr. Ruiz',
};

let token;
let contenedor;
const campo = (name) => contenedor.querySelector(`[name="${name}"]`);
const escribir = (name, value) => fireEvent.change(campo(name), { target: { name, value } });
const registrar = () => fireEvent.click(screen.getByRole('button', { name: /Registrar recogida|Guardando/ }));
const elegir = (nombre = 'elegir insumo') => fireEvent.click(screen.getByRole('button', { name: nombre }));

async function montar({ ultima = { insumo: {}, ultimaEntrega: null }, ambulancias = AMBULANCIAS } = {}) {
  token = jwtAmbulancia();
  cookiesCon(Cookies, { token, usuario: JSON.stringify({ id: 2, nombre: 'Tripulación 01', rol: 'ambulancia' }) });
  rutasGet(axios, {
    '/api/centros-asistenciales': CENTROS,
    '/api/ambulancias/activas': ambulancias,
    '/api/movimientos/ultimo-por-insumo': ultima,
  });
  ({ container: contenedor } = render(<RecogerPage />));
  await screen.findByRole('option', { name: 'Hospital General' });
}

beforeEach(() => {
  push.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('recoger/page.js · sesión', () => {
  it('sin token va al login', () => {
    cookiesCon(Cookies, {});
    rutasGet(axios, { '/api/centros-asistenciales': [] });

    render(<RecogerPage />);

    expect(push).toHaveBeenCalledWith('/login');
  });

  it('un token inválido borra las cookies y va al login', () => {
    cookiesCon(Cookies, { token: 'x.y.z' });
    rutasGet(axios, { '/api/centros-asistenciales': [] });

    render(<RecogerPage />);

    expect(Cookies.remove).toHaveBeenCalledWith('usuario');
    expect(push).toHaveBeenCalledWith('/login');
  });

  it.each([[undefined], ['{roto']])('con cookie usuario %j usa los datos del token', async (usuario) => {
    cookiesCon(Cookies, { token: jwtAmbulancia(), usuario });
    rutasGet(axios, { '/api/centros-asistenciales': [], '/api/ambulancias/activas': [] });

    render(<RecogerPage />);

    expect(await screen.findByText('Ambulancia01')).toBeInTheDocument();
  });

  // Antes la fecha por defecto se calculaba en UTC (ver entregar.test.jsx)
  it('a las 23:30 en Colombia propone la fecha de hoy, no la de mañana', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-05T23:30:00-05:00') });
    await montar();

    expect(campo('fecha')).toHaveValue('2026-10-05');
    expect(campo('hora')).toHaveValue('23:30');
  });
});

describe('recoger/page.js · prellenado desde la última entrega', () => {
  it('al elegir un insumo consulta su última entrega y prellena el formulario', async () => {
    await montar({ ultima: { insumo: {}, ultimaEntrega: ULTIMA } });

    elegir();

    expect(await screen.findByText(/Datos prellenados desde la última entrega/)).toBeInTheDocument();
    const [url, opciones] = axios.get.mock.calls.find(([u]) => u.includes('ultimo-por-insumo'));
    expect(url).toBe('http://localhost:4000/api/movimientos/ultimo-por-insumo');
    expect(opciones).toEqual({ params: { codigo: 'INS-COL-001' }, headers: { Authorization: `Bearer ${token}` } });
    expect(campo('nombrePaciente')).toHaveValue('Paciente Anterior');
    expect(campo('historiaClinica')).toHaveValue('HC-9');
    expect(campo('centroAsistencialId')).toHaveValue('99');
    expect(campo('centroOtro')).toHaveValue('Clínica X');
    expect(campo('nombreMedico')).toHaveValue('Dr. Ruiz');
  });

  it('los campos vacíos de la última entrega no borran lo ya escrito', async () => {
    await montar({ ultima: { ultimaEntrega: { nombrePaciente: null, centroAsistencialId: null } } });
    escribir('nombrePaciente', 'Escrito a mano');
    escribir('centroAsistencialId', '1');

    elegir();

    expect(await screen.findByText(/Datos prellenados/)).toBeInTheDocument();
    expect(campo('nombrePaciente')).toHaveValue('Escrito a mano');
    expect(campo('centroAsistencialId')).toHaveValue('1');
  });

  it('muestra "Buscando última entrega..." mientras consulta', async () => {
    await montar();
    let responder;
    axios.get.mockReturnValueOnce(new Promise((r) => { responder = r; }));

    elegir();

    expect(await screen.findByText('Buscando última entrega...')).toBeInTheDocument();
    await act(async () => responder({ data: { ultimaEntrega: null } }));
    expect(screen.queryByText('Buscando última entrega...')).not.toBeInTheDocument();
    expect(screen.queryByText(/Datos prellenados/)).not.toBeInTheDocument();
  });

  it('si no hay entrega previa (error 404) no prellena ni muestra error', async () => {
    await montar({ ultima: Object.assign(new Error('404'), { response: { status: 404 } }) });

    elegir();

    await waitFor(() => expect(screen.queryByText('Buscando última entrega...')).not.toBeInTheDocument());
    expect(screen.queryByText(/Datos prellenados/)).not.toBeInTheDocument();
    expect(campo('nombrePaciente')).toHaveValue('');
  });

  it('un insumo sin código no consulta la última entrega; limpiar quita el código', async () => {
    await montar();

    elegir('elegir insumo sin código');
    elegir('limpiar insumo');
    registrar();

    expect(axios.get.mock.calls.some(([u]) => u.includes('ultimo-por-insumo'))).toBe(false);
    expect(screen.getByText('Debe buscar y seleccionar un insumo válido.')).toBeInTheDocument();
  });
});

describe('recoger/page.js · validación y envío', () => {
  it.each([
    ['sin paciente', () => {}, 'El nombre del paciente es requerido.'],
    ['sin historia', () => escribir('nombrePaciente', 'P'), 'El número de historia clínica es requerido.'],
    ['sin centro', () => { escribir('nombrePaciente', 'P'); escribir('historiaClinica', 'H'); }, 'Debe seleccionar un centro asistencial.'],
    ['centro Otro sin nombre', () => {
      escribir('nombrePaciente', 'P'); escribir('historiaClinica', 'H'); escribir('centroAsistencialId', '99');
    }, 'Por favor especifica el nombre del centro asistencial.'],
    ['sin fecha', () => {
      escribir('nombrePaciente', 'P'); escribir('historiaClinica', 'H'); escribir('centroAsistencialId', '1'); escribir('fecha', '');
    }, 'La fecha es requerida.'],
    ['sin hora', () => {
      escribir('nombrePaciente', 'P'); escribir('historiaClinica', 'H'); escribir('centroAsistencialId', '1'); escribir('hora', '');
    }, 'La hora es requerida.'],
  ])('%s → error sin enviar', async (_c, preparar, mensaje) => {
    await montar();
    elegir();
    await waitFor(() => expect(screen.queryByText('Buscando última entrega...')).not.toBeInTheDocument());

    preparar();
    registrar();

    expect(screen.getByText(mensaje)).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('registra la recogida, muestra éxito, limpia y oculta el aviso a los 4 s', async () => {
    axios.post.mockResolvedValue({ data: {} });
    await montar({ ultima: { ultimaEntrega: ULTIMA } });
    elegir();
    await screen.findByText(/Datos prellenados/);
    fireEvent.change(campo('tripulacion'), { target: { value: 'AMB-05' } });
    expect(screen.getByTestId('insumo-selector')).toHaveAttribute('data-ambulancia', '5');
    escribir('tripulantes', 'Ana');
    vi.useFakeTimers();

    await act(async () => { registrar(); });

    expect(screen.getByText('✓ Recogida registrada exitosamente')).toBeInTheDocument();
    const [url, cuerpo, opciones] = axios.post.mock.calls[0];
    expect(url).toBe('http://localhost:4000/api/movimientos/recogida');
    expect(cuerpo).toMatchObject({
      codigoInsumo: 'INS-COL-001', nombrePaciente: 'Paciente Anterior', centroAsistencialId: '99',
      centroOtro: 'Clínica X', tripulacion: 'AMB-05 — Ana',
    });
    expect(cuerpo).not.toHaveProperty('tripulantes');
    expect(opciones).toEqual({ headers: { Authorization: `Bearer ${token}` } });
    expect(screen.queryByText(/Datos prellenados/)).not.toBeInTheDocument();
    expect(campo('nombrePaciente')).toHaveValue('');

    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText('✓ Recogida registrada exitosamente')).not.toBeInTheDocument();
  });

  it('con ambulancias vacías la tripulación es texto libre; una opción desconocida no asocia ambulancia', async () => {
    axios.post.mockResolvedValue({ data: {} });
    await montar({ ambulancias: [] });
    elegir();
    await waitFor(() => expect(screen.queryByText('Buscando última entrega...')).not.toBeInTheDocument());
    escribir('nombrePaciente', 'P'); escribir('historiaClinica', 'H'); escribir('centroAsistencialId', '1');
    escribir('tripulacion', 'Móvil 7');

    registrar();

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(axios.post.mock.calls[0][1].tripulacion).toBe('Móvil 7');
  });

  it('al elegir "Seleccionar ambulancia..." se quita la ambulancia asociada', async () => {
    await montar();
    fireEvent.change(campo('tripulacion'), { target: { value: 'AMB-05' } });
    fireEvent.change(campo('tripulacion'), { target: { value: '' } });

    expect(screen.getByTestId('insumo-selector')).toHaveAttribute('data-ambulancia', '');
  });

  it.each([
    [{ response: { data: { message: 'Insumo no encontrado con ese código' } } }, 'Insumo no encontrado con ese código'],
    [new Error('red'), 'Error al registrar la recogida. Intente nuevamente.'],
  ])('muestra el error del servidor (%#)', async (fallo, mensaje) => {
    axios.post.mockRejectedValue(fallo);
    await montar({ ultima: { ultimaEntrega: { ...ULTIMA, centroAsistencialId: 1 } } });
    elegir();
    await screen.findByText(/Datos prellenados/);

    registrar();

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
  });

  it('botón: hover solo si no está guardando, deshabilitado mientras guarda; foco resalta campos', async () => {
    axios.post.mockReturnValue(new Promise(() => {}));
    await montar({ ultima: { ultimaEntrega: { ...ULTIMA, centroAsistencialId: 1 } } });
    elegir();
    await screen.findByText(/Datos prellenados/);
    const boton = screen.getByRole('button', { name: 'Registrar recogida' });
    fireEvent.mouseEnter(boton);
    expect(boton.style.backgroundColor).toBe('rgb(74, 158, 110)');
    fireEvent.mouseLeave(boton);
    expect(boton.style.backgroundColor).toBe('rgb(45, 134, 83)');
    fireEvent.focus(campo('nombreMedico'));
    expect(campo('nombreMedico').style.boxShadow).toBe('0 0 0 3px rgba(45,134,83,0.15)');
    fireEvent.blur(campo('nombreMedico'));
    expect(campo('nombreMedico').style.boxShadow).toBe('none');

    registrar();

    expect(await screen.findByRole('button', { name: 'Guardando...' })).toBeDisabled();
    fireEvent.mouseEnter(boton);
    fireEvent.mouseLeave(boton);
    expect(boton.style.backgroundColor).toBe('rgb(157, 201, 179)');
  });
});
