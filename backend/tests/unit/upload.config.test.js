import { describe, it, expect, vi, afterEach } from 'vitest';
import path from 'node:path';
import { cjs } from '../helpers.js';

const fs = cjs('fs');

// Las dos configuraciones de multer son casi iguales; solo cambian carpeta, tipos y límite.
const CONFIGS = [
  {
    nombre: 'config/upload.js (fotos de insumos)',
    modulo: '../src/config/upload',
    carpeta: path.join('uploads', 'insumos'),
    limite: 5 * 1024 * 1024,
    mensaje: 'Solo se permiten imágenes JPG o PNG',
    validos: [
      ['foto.jpg', 'image/jpeg'],
      ['foto.JPEG', 'image/jpeg'],
      ['foto.png', 'image/png'],
    ],
    invalidos: [
      ['foto.webp', 'image/webp'],      // webp no se admite en insumos
      ['foto.gif', 'image/gif'],
      ['foto.png', 'application/pdf'],  // extensión válida, mimetype no
      ['foto.pdf', 'image/png'],        // mimetype válido, extensión no
      ['script.js', 'text/javascript'],
      ['sin-extension', 'image/png'],
    ],
  },
  {
    nombre: 'config/uploadEvidencia.js (evidencias de daño/pérdida)',
    modulo: '../src/config/uploadEvidencia',
    carpeta: path.join('uploads', 'evidencias'),
    limite: 8 * 1024 * 1024,
    mensaje: 'Solo se permiten imágenes JPG, PNG o WEBP',
    validos: [
      ['foto.jpg', 'image/jpeg'],
      ['foto.png', 'image/png'],
      ['foto.WEBP', 'image/webp'],
      // Extensión y mimetype se validan por separado: basta con que cada uno esté permitido
      ['foto.webp', 'image/png'],
    ],
    invalidos: [
      ['foto.gif', 'image/gif'],
      ['foto.svg', 'image/svg+xml'],
      ['foto.jpg', 'text/html'],
    ],
  },
];

// Carga el módulo de nuevo (sin caché) para ejecutar su código de arranque con fs simulado.
// Al terminar se restaura la entrada original de la caché para no afectar a otras pruebas.
function cargarDeNuevo(modulo) {
  const ruta = cjs.resolve(modulo);
  const original = cjs.cache[ruta];
  delete cjs.cache[ruta];
  try {
    return cjs(modulo);
  } finally {
    if (original) cjs.cache[ruta] = original;
    else delete cjs.cache[ruta];
  }
}

// Ejecuta un callback estilo multer y devuelve sus argumentos
function llamar(fn, ...args) {
  return new Promise((resolve) => fn(...args, (...cbArgs) => resolve(cbArgs)));
}

afterEach(() => {
  vi.useRealTimers();
});

describe.each(CONFIGS)('$nombre', (cfg) => {
  const upload = cjs(cfg.modulo);

  it(`limita el tamaño a ${cfg.limite / 1024 / 1024} MB`, () => {
    expect(upload.limits).toEqual({ fileSize: cfg.limite });
  });

  it.each(cfg.validos)('acepta %s (%s)', async (originalname, mimetype) => {
    const [error, aceptado] = await llamar(upload.fileFilter, {}, { originalname, mimetype });

    expect(error).toBeNull();
    expect(aceptado).toBe(true);
  });

  it.each(cfg.invalidos)('rechaza %s (%s) con un mensaje claro', async (originalname, mimetype) => {
    const [error, aceptado] = await llamar(upload.fileFilter, {}, { originalname, mimetype });

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(cfg.mensaje);
    expect(aceptado).toBeUndefined();
  });

  it('guarda en su carpeta de uploads del backend', async () => {
    const [error, destino] = await llamar(upload.storage.getDestination, {}, {});

    expect(error).toBeNull();
    expect(destino.endsWith(path.join('backend', cfg.carpeta))).toBe(true);
  });

  it('genera un nombre único <timestamp>-<aleatorio><ext en minúsculas> sin usar el nombre original', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-05T10:00:00Z') });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const [error, nombre] = await llamar(
      upload.storage.getFilename,
      {},
      { originalname: '../../etc/Foto Paciente.PNG' },
    );

    expect(error).toBeNull();
    expect(nombre).toBe(`${Date.parse('2026-10-05T10:00:00Z')}-500000000.png`);
  });

  it('crea la carpeta (recursiva) si no existe al cargar el módulo', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const mkdir = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);

    cargarDeNuevo(cfg.modulo);

    expect(mkdir).toHaveBeenCalledTimes(1);
    const [carpeta, opciones] = mkdir.mock.calls[0];
    expect(carpeta.endsWith(path.join('backend', cfg.carpeta))).toBe(true);
    expect(opciones).toEqual({ recursive: true });
  });

  it('no intenta crear la carpeta si ya existe', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const mkdir = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);

    cargarDeNuevo(cfg.modulo);

    expect(mkdir).not.toHaveBeenCalled();
  });
});
