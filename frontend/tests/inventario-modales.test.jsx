// Segunda parte de las pruebas de inventario/page.js: QR, búsqueda por código (manual y con cámara),
// resultado de la búsqueda e historial de bajas. La tabla y los modales de CRUD están en inventario.test.jsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
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
const COLLARIN = {
  id: 1, codigo: 'INS-COL-001', nombre: 'Collarín talla S', familia: 'Collarín cervical', familia_abrev: 'COL',
  especificaciones: 'Talla S', ambulanciaId: 5, ambulancia: { codigo: 'AMB-05' }, estado: 'activo', fecha_creacion: '01-02-2026',
};
const VENDA = {
  id: 2, codigo: null, nombre: 'Venda elástica', familia: null, especificaciones: null,
  ambulanciaId: null, ambulancia: null, estado: 'activo', fecha_creacion: null, createdAt: null,
};

let token;
const cabeceras = () => ({ Authorization: `Bearer ${token}` });
const fila = (nombre) => screen.getByText(nombre).closest('tr');
const modal = () => screen.getByRole('heading', { level: 2 }).parentElement;
const sinModal = () => expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();

async function montar({ rol = 'admin', rutas = {} } = {}) {
  token = rol === 'admin' ? jwtAdmin() : jwtAmbulancia();
  cookiesCon(Cookies, { token });
  rutasGet(axios, { '/api/insumos': [COLLARIN, VENDA], '/api/ambulancias': [{ id: 5, codigo: 'AMB-05' }], ...rutas });
  const r = render(<InventarioPage />);
  await screen.findByText('Collarín talla S');
  return r;
}

const llamadasA = (url) => axios.get.mock.calls.filter(([u]) => u === url).length;

beforeEach(() => {
  push.mockReset();
});

describe('inventario/page.js · tarjeta QR', () => {
  it('pide la imagen como blob, muestra la tarjeta y descarga el PNG con el código', async () => {
    const blob = new Blob(['png'], { type: 'image/png' });
    await montar({ rutas: { '/api/insumos/1/qr': blob } });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:qr');
    let descargado;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      descargado = { href: this.href, download: this.download };
    });

    fireEvent.click(within(fila('Collarín talla S')).getByRole('button', { name: '🔲 QR' }));

    const tarjeta = document.getElementById('qr-card');
    expect(within(tarjeta).getByText('Generando QR...')).toBeInTheDocument();
    expect(await within(tarjeta).findByAltText('QR')).toHaveAttribute('src', 'blob:qr');
    expect(axios.get).toHaveBeenCalledWith(`${API}/api/insumos/1/qr`, { headers: cabeceras(), responseType: 'blob' });
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    for (const t of ['INS-COL-001', 'Collarín talla S', 'Collarín cervical', 'Talla S', 'AMB-05']) {
      expect(within(tarjeta).getByText(t)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('button', { name: '⬇ Descargar QR' }));
    expect(descargado).toEqual({ href: 'blob:qr', download: 'qr-INS-COL-001.png' });
  });

  it('sin código usa el id en la tarjeta y en el nombre del archivo', async () => {
    await montar({ rutas: { '/api/insumos/2/qr': new Blob(['x']) } });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:qr2');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {});

    fireEvent.click(within(fila('Venda elástica')).getByRole('button', { name: '🔲 QR' }));
    const tarjeta = document.getElementById('qr-card');
    await within(tarjeta).findByAltText('QR');

    expect(within(tarjeta).getByText('#2')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Sin asignar')).toBeInTheDocument();
    expect(within(tarjeta).queryByText('Collarín cervical')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '⬇ Descargar QR' }));
    expect(click.mock.contexts[0].download).toBe('qr-2.png');
  });

  it('si el QR falla no muestra imagen y la descarga queda deshabilitada; imprimir usa window.print', async () => {
    await montar({ rutas: { '/api/insumos/1/qr': new Error('500') } });
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});

    fireEvent.click(within(fila('Collarín talla S')).getByRole('button', { name: '🔲 QR' }));

    await waitFor(() => expect(screen.queryByText('Generando QR...')).not.toBeInTheDocument());
    expect(screen.queryByAltText('QR')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '⬇ Descargar QR' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '🖨 Imprimir' }));
    expect(imprimir).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(document.getElementById('qr-card')).toBeNull();
  });
});

describe('inventario/page.js · buscar por código (manual)', () => {
  const abrirManual = async (rutas) => {
    await montar({ rutas });
    fireEvent.click(screen.getByRole('button', { name: '🔍 Buscar por código' }));
    expect(screen.getByRole('heading', { name: 'Buscar insumo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '⌨️ Ingresar código manual' }));
  };
  const campo = () => screen.getByPlaceholderText('INS-COL-001');

  it('sin cámara en el navegador no ofrece abrirla', async () => {
    await montar();

    fireEvent.click(screen.getByRole('button', { name: '🔍 Buscar por código' }));

    expect(screen.queryByRole('button', { name: '📷 Abrir cámara' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '⌨️ Ingresar código manual' })).toBeInTheDocument();
  });

  it('un código vacío pide que se ingrese uno; Volver regresa al inicio', async () => {
    await abrirManual();

    fireEvent.change(campo(), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar insumo' }));
    expect(screen.getByText('Ingresa un código')).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(screen.getByRole('button', { name: '⌨️ Ingresar código manual' })).toBeInTheDocument();
  });

  it('busca en mayúsculas y codificado, y abre el resultado', async () => {
    let resolver;
    await abrirManual();
    axios.get.mockImplementationOnce(() => new Promise((r) => { resolver = r; }));

    fireEvent.change(campo(), { target: { value: ' ins-col 001 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar insumo' }));

    expect(await screen.findByText('Buscando insumo...')).toBeInTheDocument();
    expect(axios.get).toHaveBeenLastCalledWith(`${API}/api/insumos/qr/INS-COL%20001`, { headers: cabeceras() });
    resolver({ data: COLLARIN });

    expect(await screen.findByRole('heading', { name: 'Insumo encontrado' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Buscar insumo' })).not.toBeInTheDocument();
  });

  it.each([
    [404, 'No se encontró ningún insumo con ese código'],
    [500, 'Error al consultar el código'],
  ])('si la búsqueda responde %s muestra el error y permite reintentar', async (status, texto) => {
    const err = Object.assign(new Error('x'), { response: { status } });
    await abrirManual({ '/api/insumos/qr/NO-EXISTE': err });

    fireEvent.change(campo(), { target: { value: 'no-existe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar insumo' }));

    expect(await screen.findByText(texto)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Intentar con otro código' }));
    expect(campo()).toHaveValue('');
    expect(screen.queryByText(texto)).not.toBeInTheDocument();
  });

  it('desde el error "Volver" regresa al inicio sin mensaje', async () => {
    await abrirManual({ '/api/insumos/qr/X': new Error('red') });
    fireEvent.change(campo(), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar insumo' }));
    await screen.findByText('Error al consultar el código');

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));

    expect(screen.getByRole('button', { name: '⌨️ Ingresar código manual' })).toBeInTheDocument();
    expect(screen.queryByText('Error al consultar el código')).not.toBeInTheDocument();
  });

  it('el fondo cierra el modal de búsqueda', async () => {
    await abrirManual();

    fireEvent.click(modal().parentElement);

    sinModal();
  });
});

describe('inventario/page.js · buscar con la cámara', () => {
  let track;
  let getUserMedia;
  let estadoVideo;
  const descriptorReadyState = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'readyState');

  beforeEach(() => {
    track = { stop: vi.fn() };
    getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [track] });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
    estadoVideo = 4;
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => estadoVideo });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    delete navigator.mediaDevices;
    delete window.BarcodeDetector;
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', descriptorReadyState);
  });

  const abrirCamara = async (rutas) => {
    await montar({ rutas });
    fireEvent.click(screen.getByRole('button', { name: '🔍 Buscar por código' }));
    fireEvent.click(screen.getByRole('button', { name: '📷 Abrir cámara' }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
  };

  it('pide la cámara trasera y, sin BarcodeDetector, ofrece escribir el código', async () => {
    await abrirCamara({ '/api/insumos/qr/INS-VEN-001': VENDA });

    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 } } });
    expect(screen.getByText('Apunta la cámara al código QR del insumo')).toBeInTheDocument();
    await waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
    expect(screen.getByText('Escaneo automático no disponible. Ingresa el código:')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('INS-COL-001'), { target: { value: 'ins-ven-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByRole('heading', { name: 'Insumo encontrado' })).toBeInTheDocument();
    expect(track.stop).toHaveBeenCalled();
  });

  it('"Ingresar código manualmente" apaga la cámara y pasa al modo manual', async () => {
    await abrirCamara();

    fireEvent.click(screen.getByRole('button', { name: 'Ingresar código manualmente' }));

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Buscar insumo' })).toBeInTheDocument();
  });

  it('si no hay permiso de cámara muestra el error', async () => {
    getUserMedia.mockRejectedValue(new Error('NotAllowedError'));

    await abrirCamara();

    expect(await screen.findByText('No se pudo acceder a la cámara. Verifica los permisos del navegador.')).toBeInTheDocument();
  });

  it('con BarcodeDetector escanea cada 300 ms y busca el primer QR detectado', async () => {
    const detect = vi.fn();
    const formatos = [];
    window.BarcodeDetector = class { constructor(o) { formatos.push(o); } detect(v) { return detect(v); } };
    const intervalo = vi.spyOn(globalThis, 'setInterval').mockReturnValue(4242);
    const limpiar = vi.spyOn(globalThis, 'clearInterval');

    await abrirCamara({ '/api/insumos/qr/INS-COL-001': COLLARIN });
    await waitFor(() => expect(intervalo).toHaveBeenCalledWith(expect.any(Function), 300));
    const tick = intervalo.mock.calls.find(([, ms]) => ms === 300)[0];
    expect(formatos).toEqual([{ formats: ['qr_code'] }]);
    expect(screen.queryByText('Escaneo automático no disponible. Ingresa el código:')).not.toBeInTheDocument();

    // Video aún sin datos: no intenta detectar
    estadoVideo = 1;
    await act(() => tick());
    expect(detect).not.toHaveBeenCalled();

    // Nada detectado, y un error del detector se ignora
    estadoVideo = 4;
    detect.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('frame'));
    await act(() => tick());
    await act(() => tick());
    expect(detect).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Apunta la cámara al código QR del insumo')).toBeInTheDocument();

    detect.mockResolvedValueOnce([{ rawValue: 'ins-col-001' }, { rawValue: 'otro' }]);
    await act(() => tick());

    expect(limpiar).toHaveBeenCalledWith(4242);
    expect(track.stop).toHaveBeenCalled();
    expect(axios.get).toHaveBeenLastCalledWith(`${API}/api/insumos/qr/INS-COL-001`, { headers: cabeceras() });
    expect(await screen.findByRole('heading', { name: 'Insumo encontrado' })).toBeInTheDocument();
  });

  it('cerrar el modal con la cámara abierta la apaga', async () => {
    await abrirCamara();

    fireEvent.click(modal().parentElement);

    sinModal();
    expect(track.stop).toHaveBeenCalled();
  });
});

describe('inventario/page.js · resultado de la búsqueda', () => {
  async function encontrar(insumo, { rol = 'admin', rutas = {} } = {}) {
    await montar({ rol, rutas: { '/api/insumos/qr/BUSCADO': insumo, ...rutas } });
    fireEvent.click(screen.getByRole('button', { name: '🔍 Buscar por código' }));
    fireEvent.click(screen.getByRole('button', { name: '⌨️ Ingresar código manual' }));
    fireEvent.change(screen.getByPlaceholderText('INS-COL-001'), { target: { value: 'buscado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar insumo' }));
    await screen.findByRole('heading', { name: 'Insumo encontrado' });
  }

  it('muestra los datos del insumo activo y sus acciones', async () => {
    await encontrar(COLLARIN);

    const m = modal();
    for (const t of ['INS-COL-001', 'Collarín cervical', 'Talla S', 'Activo', 'AMB-05', 'Creado: 01-02-2026']) {
      expect(within(m).getByText(t)).toBeInTheDocument();
    }
    expect(within(m).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['✏️ Editar', '🚑 Reasignar', 'Dar de baja', 'Cerrar']);
  });

  it('un insumo dado de baja y sin datos opcionales no tiene acciones', async () => {
    await encontrar({ id: 7, codigo: null, nombre: 'Viejo', estado: 'baja', ambulancia: null, createdAt: '2026-01-05T12:00:00Z' });

    const m = modal();
    for (const t of ['#7', 'Dado de baja', 'Sin ambulancia', 'Creado: 05-01-2026']) {
      expect(within(m).getByText(t)).toBeInTheDocument();
    }
    expect(within(m).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cerrar']);

    fireEvent.click(within(m).getByRole('button', { name: 'Cerrar' }));
    sinModal();
  });

  it('editar desde el resultado guarda, recarga el insumo y la tabla, y vuelve al resultado', async () => {
    await encontrar(COLLARIN, { rutas: { '/api/insumos/1': { ...COLLARIN, nombre: 'Collarín editado' } } });
    axios.put.mockResolvedValue({ data: {} });
    const listas = llamadasA(`${API}/api/insumos`);

    fireEvent.click(screen.getByRole('button', { name: '✏️ Editar' }));
    expect(screen.getByRole('heading', { name: 'Editar insumo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await within(await screen.findByRole('heading', { name: 'Insumo encontrado' }).then((h) => h.parentElement))
      .findByText('Collarín editado')).toBeInTheDocument();
    expect(axios.put).toHaveBeenCalledWith(`${API}/api/insumos/1`, expect.any(Object), { headers: cabeceras() });
    expect(axios.get).toHaveBeenCalledWith(`${API}/api/insumos/1`, { headers: cabeceras() });
    expect(llamadasA(`${API}/api/insumos`)).toBe(listas + 1);
  });

  it.each([
    ['🚑 Reasignar', 'Reasignar ambulancia'],
    ['Dar de baja', 'Dar de baja'],
    ['✏️ Editar', 'Editar insumo'],
  ])('"%s" abre su modal y Cancelar vuelve al resultado', async (boton, titulo) => {
    await encontrar(COLLARIN);

    fireEvent.click(screen.getByRole('button', { name: boton }));
    expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('heading', { name: 'Insumo encontrado' })).toBeInTheDocument();
  });

  it('si guardar sale bien pero falla la recarga del insumo, avisa y conserva los datos anteriores', async () => {
    await encontrar(COLLARIN, { rutas: { '/api/insumos/1': new Error('red') } });
    axios.put.mockResolvedValue({ data: {} });
    const listas = llamadasA(`${API}/api/insumos`);

    fireEvent.click(screen.getByRole('button', { name: '✏️ Editar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    const m = await screen.findByRole('heading', { name: 'Insumo encontrado' }).then((h) => h.parentElement);
    expect(await within(m).findByText('El cambio se guardó, pero no se pudo actualizar la información del insumo. Cierra y vuelve a buscarlo.')).toBeInTheDocument();
    expect(within(m).getByText('Collarín talla S')).toBeInTheDocument();
    expect(llamadasA(`${API}/api/insumos`)).toBe(listas + 1);
  });

  it('reasignar desde el resultado recarga el insumo', async () => {
    await encontrar(COLLARIN, { rutas: { '/api/insumos/1': { ...COLLARIN, ambulancia: null } } });
    axios.post.mockResolvedValue({ data: {} });

    fireEvent.click(screen.getByRole('button', { name: '🚑 Reasignar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reasignación' }));

    expect(await screen.findByText('Sin ambulancia')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith(`${API}/api/insumos/1/reasignar`, expect.objectContaining({ tipo: 'permanente' }), expect.anything());
  });

  it('el rol ambulancia ve los datos del insumo pero no las acciones de administración', async () => {
    await encontrar(COLLARIN, { rol: 'ambulancia' });

    const m = modal();
    expect(within(m).getByText('INS-COL-001')).toBeInTheDocument();
    for (const b of ['✏️ Editar', '🚑 Reasignar', 'Dar de baja']) {
      expect(within(m).queryByRole('button', { name: b })).not.toBeInTheDocument();
    }
    expect(within(m).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cerrar']);
  });
});

describe('inventario/page.js · historial de bajas', () => {
  const BAJAS = [
    { id: 1, codigo: 'INS-COL-009', nombre: 'Collarín roto', familia: 'Collarín cervical', ambulancia_codigo: 'AMB-05',
      motivo: 'm'.repeat(70), foto_ruta: '/uploads/evidencias/a.png', fecha_baja_fmt: '05-03-2026' },
    { id: 2, codigo: 'INS-VEN-009', nombre: 'Venda sucia', familia: null, ambulancia_codigo: null,
      motivo: 'Contaminada', foto_ruta: null, fecha_baja: '2026-03-06T17:00:00Z' },
  ];

  it('muestra "Cargando..." y luego cada baja con sus valores por defecto', async () => {
    let resolver;
    await montar();
    axios.get.mockImplementationOnce(() => new Promise((r) => { resolver = r; }));

    fireEvent.click(screen.getByRole('button', { name: '📋 Historial bajas' }));

    expect(within(modal()).getByText('Cargando...')).toBeInTheDocument();
    expect(axios.get).toHaveBeenLastCalledWith(`${API}/api/insumos/bajas`, { headers: cabeceras() });
    resolver({ data: BAJAS });

    await within(modal()).findByText('Collarín roto');
    const filas = within(modal()).getAllByRole('row').slice(1).map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent));
    expect(filas).toEqual([
      ['INS-COL-009', 'Collarín roto', 'Collarín cervical', 'AMB-05', `${'m'.repeat(60)}…`, 'Ver foto', '05-03-2026'],
      ['INS-VEN-009', 'Venda sucia', '—', '—', 'Contaminada', '—', '06-03-2026'],
    ]);
    expect(within(modal()).getByTitle('m'.repeat(70))).toBeInTheDocument();
    expect(within(modal()).getByRole('link', { name: 'Ver foto' })).toHaveAttribute('href', `${API}/uploads/evidencias/a.png`);
  });

  it('sin bajas (o si falla la consulta) muestra el mensaje vacío y Cerrar lo oculta', async () => {
    await montar({ rutas: { '/api/insumos/bajas': new Error('500') } });

    fireEvent.click(screen.getByRole('button', { name: '📋 Historial bajas' }));

    expect(await within(modal()).findByText('No hay insumos dados de baja aún.')).toBeInTheDocument();
    fireEvent.click(within(modal()).getByRole('button', { name: 'Cerrar' }));
    sinModal();
  });
});
