import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import Cookies from 'js-cookie';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('js-cookie', () => ({ default: { get: vi.fn(() => 'token-prueba') } }));

// Escáner QR falso: la prueba decide si start() funciona y cuándo "se lee" un código
const escaner = { start: vi.fn(), stop: vi.fn(), onLeido: null, id: null };
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    constructor(id) { escaner.id = id; }
    start(...args) { escaner.onLeido = args[2]; return escaner.start(...args); }
    stop() { return escaner.stop(); }
  },
}));

import InsumoSelector from '../app/dashboard/_components/InsumoSelector';

const collarin = {
  id: 1, codigo: 'INS-COL-001', nombre: 'Collarín cervical', especificaciones: 'Adulto', ambulancia: { codigo: 'AMB-01' },
};
const ferula = { id: 2, codigo: 'INS-FER-002', nombre: 'Férula', especificaciones: null, ambulancia: null };

let onSel;
const campo = () => screen.getByPlaceholderText('Escribe nombre o código del insumo...');

function montar() {
  onSel = vi.fn();
  return render(
    <InsumoSelector accentColor="#2d8653" accentLight="#e8f3ed" accentBorder="#b5d9c5" onInsumoSeleccionado={onSel} />,
  );
}

beforeEach(() => {
  Cookies.get.mockReturnValue('token-prueba');
  escaner.start.mockResolvedValue(undefined);
  escaner.stop.mockResolvedValue(undefined);
});

describe('InsumoSelector · búsqueda con autocompletado', () => {
  it('con menos de 2 caracteres no consulta la API', async () => {
    const user = userEvent.setup();
    montar();

    await user.type(campo(), 'c');
    await new Promise((r) => setTimeout(r, 350));

    expect(axios.get).not.toHaveBeenCalled();
    expect(onSel).toHaveBeenLastCalledWith(null);
  });

  it('busca con debounce y muestra las sugerencias con su detalle', async () => {
    axios.get.mockResolvedValue({ data: [collarin, ferula] });
    const user = userEvent.setup();
    montar();

    await user.type(campo(), ' col ');

    expect(await screen.findByText('Collarín cervical')).toBeInTheDocument();
    expect(screen.getByText('INS-COL-001 · Adulto · AMB-01')).toBeInTheDocument();
    expect(screen.getByText('INS-FER-002')).toBeInTheDocument();
    // Solo la última pulsación llega a la API (debounce), con el texto sin espacios y el token
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith('http://localhost:4000/api/insumos/buscar', {
      params: { q: 'col' },
      headers: { Authorization: 'Bearer token-prueba' },
    });
  });

  it('elegir una sugerencia la confirma y avisa al padre', async () => {
    axios.get.mockResolvedValue({ data: [collarin] });
    const user = userEvent.setup();
    montar();

    await user.type(campo(), 'col');
    const opcion = await screen.findByText('Collarín cervical');
    fireEvent.mouseEnter(opcion.closest('li'));
    expect(opcion.closest('li').style.backgroundColor).toBe('rgb(232, 243, 237)');
    fireEvent.mouseLeave(opcion.closest('li'));
    fireEvent.mouseDown(opcion.closest('li'));

    expect(onSel).toHaveBeenLastCalledWith(collarin);
    expect(campo()).toHaveValue('INS-COL-001');
    expect(screen.getByText('(INS-COL-001)')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('sin resultados muestra el mensaje de vacío', async () => {
    axios.get.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    montar();

    await user.type(campo(), 'zzz');

    expect(await screen.findByText('No se encontraron insumos con ese nombre o código')).toBeInTheDocument();
  });

  it('si la búsqueda falla también muestra la lista vacía (sin romper la página)', async () => {
    axios.get.mockRejectedValue(new Error('red'));
    const user = userEvent.setup();
    montar();

    await user.type(campo(), 'col');

    expect(await screen.findByText('No se encontraron insumos con ese nombre o código')).toBeInTheDocument();
  });

  it('Enter con sugerencias elige la primera; Escape y un clic afuera cierran la lista', async () => {
    axios.get.mockResolvedValue({ data: [collarin, ferula] });
    const user = userEvent.setup();
    montar();

    await user.type(campo(), 'in');
    await screen.findByText('Collarín cervical');

    fireEvent.keyDown(campo(), { key: 'Escape' });
    expect(screen.queryByText('Collarín cervical')).not.toBeInTheDocument();

    // Al volver a enfocar, la lista reaparece porque ya se buscó
    fireEvent.focus(campo());
    expect(screen.getByText('Collarín cervical')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Collarín cervical')).not.toBeInTheDocument();

    fireEvent.keyDown(campo(), { key: 'Enter' });
    expect(onSel).toHaveBeenLastCalledWith(collarin);
  });

  it('Enter antes de que llegue la búsqueda consulta el código exacto', async () => {
    axios.get.mockResolvedValue({ data: ferula });
    montar();

    fireEvent.change(campo(), { target: { value: 'INS-FER-002' } });
    fireEvent.keyDown(campo(), { key: 'Enter' });

    await waitFor(() => expect(onSel).toHaveBeenLastCalledWith(ferula));
    expect(axios.get).toHaveBeenCalledWith('http://localhost:4000/api/insumos/qr/INS-FER-002', {
      headers: { Authorization: 'Bearer token-prueba' },
    });
    // Sin especificaciones ni ambulancia no se repite la línea de detalle
    expect(screen.getAllByText(/INS-FER-002/)).toHaveLength(1);
  });

  it('un código inexistente muestra el mensaje del servidor y limpia la selección', async () => {
    axios.get.mockRejectedValue({ response: { data: { message: 'No se encontró ningún insumo con ese código QR' } } });
    montar();

    fireEvent.change(campo(), { target: { value: 'NOEXISTE' } });
    fireEvent.keyDown(campo(), { key: 'Enter' });

    expect(await screen.findByText('No se encontró ningún insumo con ese código QR')).toBeInTheDocument();
    expect(onSel).toHaveBeenLastCalledWith(null);
  });

  it('un error sin respuesta muestra el mensaje genérico; Enter con el campo vacío no hace nada', async () => {
    axios.get.mockRejectedValue(new Error('red'));
    montar();

    fireEvent.keyDown(campo(), { key: 'Enter' });
    expect(axios.get).not.toHaveBeenCalled();

    fireEvent.change(campo(), { target: { value: 'X' } });
    fireEvent.keyDown(campo(), { key: 'Enter' });
    expect(await screen.findByText('Insumo no encontrado con ese código.')).toBeInTheDocument();
  });
});

describe('InsumoSelector · escaneo QR', () => {
  const irAQr = () => fireEvent.click(screen.getByRole('button', { name: '📷 Escanear QR' }));

  it('cambiar de pestaña limpia la selección; pulsar la pestaña activa no hace nada', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: '⌨️ Buscar insumo' }));
    expect(onSel).not.toHaveBeenCalled();

    irAQr();
    expect(onSel).toHaveBeenCalledWith(null);
    expect(screen.queryByPlaceholderText('Escribe nombre o código del insumo...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '📷 Activar cámara' })).toBeInTheDocument();
  });

  it('activa la cámara trasera, y al leer un código lo busca y apaga la cámara', async () => {
    axios.get.mockResolvedValue({ data: collarin });
    montar();
    irAQr();

    fireEvent.click(screen.getByRole('button', { name: '📷 Activar cámara' }));
    expect(await screen.findByRole('button', { name: '✕ Detener cámara' })).toBeInTheDocument();
    expect(escaner.id).toBe('qr-reader-selector');
    expect(escaner.start.mock.calls[0][0]).toEqual({ facingMode: 'environment' });

    await act(() => escaner.onLeido('INS-COL-001'));

    await waitFor(() => expect(onSel).toHaveBeenLastCalledWith(collarin));
    expect(escaner.stop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '📷 Activar cámara' })).toBeInTheDocument();
  });

  it('el botón Detener apaga la cámara aunque stop() falle', async () => {
    escaner.stop.mockRejectedValue(new Error('ya detenida'));
    montar();
    irAQr();

    fireEvent.click(screen.getByRole('button', { name: '📷 Activar cámara' }));
    fireEvent.click(await screen.findByRole('button', { name: '✕ Detener cámara' }));

    expect(await screen.findByRole('button', { name: '📷 Activar cámara' })).toBeInTheDocument();
    expect(escaner.stop).toHaveBeenCalledTimes(1);
  });

  it.each([
    [new Error('Permission denied by user'), 'Permisos de cámara denegados. Habilita el acceso en la configuración del navegador.'],
    ['NotAllowedError: denied', 'Permisos de cámara denegados. Habilita el acceso en la configuración del navegador.'],
    [new Error('No camera found'), 'No se pudo activar la cámara. Verifica que tu dispositivo tenga cámara disponible.'],
    [{}, 'No se pudo activar la cámara. Verifica que tu dispositivo tenga cámara disponible.'],
  ])('si la cámara falla (%j) explica el motivo', async (fallo, mensaje) => {
    escaner.start.mockRejectedValue(fallo);
    montar();
    irAQr();

    fireEvent.click(screen.getByRole('button', { name: '📷 Activar cámara' }));

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
  });

  it('al desmontar con la cámara encendida la detiene', async () => {
    const { unmount } = montar();
    irAQr();
    fireEvent.click(screen.getByRole('button', { name: '📷 Activar cámara' }));
    await screen.findByRole('button', { name: '✕ Detener cámara' });

    unmount();

    expect(escaner.stop).toHaveBeenCalledTimes(1);
  });
});
