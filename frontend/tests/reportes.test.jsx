import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtAdmin, jwtAmbulancia, cookiesCon } from './helpers.js';

const push = vi.fn();
const router = { push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('js-cookie', () => ({ default: { get: vi.fn(), remove: vi.fn() } }));

import ReportesAmbulanciaPage from '../app/dashboard/reportes/page';

const filas = [
  {
    id: 1, insumoNombre: 'Collarín cervical', codigoInsumo: 'INS-COL-001', centroNombre: 'Hospital General',
    centroOtro: null, fecha: '2026-10-05', hora: '14:30:00', estadoActual: 'Recuperado', nombreMedico: 'Dra. Pérez',
  },
  {
    id: 2, insumoNombre: null, codigoInsumo: null, centroNombre: 'Hospital General',
    centroOtro: 'Clínica Particular', fecha: null, hora: null, estadoActual: 'En centro', nombreMedico: null,
  },
  {
    id: 3, insumoNombre: 'Férula', codigoInsumo: 'INS-FER-001', centroNombre: null, centroOtro: null,
    fecha: '05/10/2026', hora: '08:00', estadoActual: 'En centro', nombreMedico: 'Dr. Ruiz',
  },
];

beforeEach(() => {
  push.mockReset();
});

describe('reportes/page.js (Mis entregas, rol ambulancia)', () => {
  it('sin token va al login', () => {
    cookiesCon(Cookies, {});

    render(<ReportesAmbulanciaPage />);

    expect(push).toHaveBeenCalledWith('/login');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('un token inválido borra las cookies y va al login', () => {
    cookiesCon(Cookies, { token: 'basura' });

    render(<ReportesAmbulanciaPage />);

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('un admin es enviado al dashboard (página solo para ambulancias)', () => {
    cookiesCon(Cookies, { token: jwtAdmin() });

    render(<ReportesAmbulanciaPage />);

    expect(push).toHaveBeenCalledWith('/dashboard');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('carga las entregas con el token y muestra la tabla formateada', async () => {
    const token = jwtAmbulancia();
    cookiesCon(Cookies, { token, usuario: JSON.stringify({ id: 2, nombre: 'Tripulación 01', rol: 'ambulancia' }) });
    axios.get.mockResolvedValue({ data: filas });

    render(<ReportesAmbulanciaPage />);

    expect(screen.getByText('Cargando registros...')).toBeInTheDocument();
    expect(await screen.findByText('Collarín cervical')).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith('http://localhost:4000/api/reportes/mis-entregas', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(screen.getByText('Tripulación 01')).toBeInTheDocument();

    const [, fila1, fila2, fila3] = screen.getAllByRole('row');
    // Fecha AAAA-MM-DD → DD-MM-AAAA y hora recortada a HH:MM
    expect(within(fila1).getByText('05-10-2026')).toBeInTheDocument();
    expect(within(fila1).getByText('14:30')).toBeInTheDocument();
    expect(within(fila1).getByText('✓ Recuperado')).toBeInTheDocument();
    expect(within(fila1).getByText('INS-COL-001')).toBeInTheDocument();
    // "Otro centro" tiene prioridad; los vacíos se muestran como —
    expect(within(fila2).getByText('Clínica Particular')).toBeInTheDocument();
    expect(within(fila2).getAllByText('—')).toHaveLength(4);
    expect(within(fila2).getByText('⏳ En centro asistencial')).toBeInTheDocument();
    // Una fecha con otro formato se deja como viene; sin centro → —
    expect(within(fila3).getByText('05/10/2026')).toBeInTheDocument();
    expect(within(fila3).getByText('—')).toBeInTheDocument();

    expect(screen.getByText('3 registros')).toBeInTheDocument();
  });

  it('con un solo registro usa el singular', async () => {
    cookiesCon(Cookies, { token: jwtAmbulancia() });
    axios.get.mockResolvedValue({ data: [filas[0]] });

    render(<ReportesAmbulanciaPage />);

    expect(await screen.findByText('1 registro')).toBeInTheDocument();
    // Sin cookie "usuario" usa el número de ambulancia del token
    expect(screen.getByText('Ambulancia01')).toBeInTheDocument();
  });

  it('sin entregas muestra el estado vacío', async () => {
    cookiesCon(Cookies, { token: jwtAmbulancia(), usuario: '{json-roto' });
    axios.get.mockResolvedValue({ data: [] });

    render(<ReportesAmbulanciaPage />);

    expect(await screen.findByText('No tienes entregas registradas todavía.')).toBeInTheDocument();
    expect(screen.queryByText(/registros?$/)).not.toBeInTheDocument();
  });

  it('si la API falla muestra un error', async () => {
    cookiesCon(Cookies, { token: jwtAmbulancia() });
    axios.get.mockRejectedValue(new Error('500'));

    render(<ReportesAmbulanciaPage />);

    expect(await screen.findByText('No se pudo cargar el reporte. Intente nuevamente.')).toBeInTheDocument();
  });
});
