import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cjs } from '../helpers.js';

// config/database.js solo construye la instancia de Sequelize según las variables de entorno.
// Se reemplaza el constructor por un espía: no se abre ninguna conexión real.
const sequelizePkg = cjs('sequelize');
const dotenv = cjs('dotenv');

const VARIABLES = ['DATABASE_URL', 'DB_SSL_REJECT_UNAUTHORIZED', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_PORT', 'NODE_ENV'];
let respaldo;
let constructor;

// Carga config/database.js sin caché y devuelve los argumentos con los que llamó a new Sequelize
function cargarConfig() {
  const ruta = cjs.resolve('../src/config/database');
  const original = cjs.cache[ruta];
  delete cjs.cache[ruta];
  try {
    const instancia = cjs('../src/config/database');
    expect(constructor).toHaveBeenCalledTimes(1);
    return { instancia, args: constructor.mock.calls[0] };
  } finally {
    if (original) cjs.cache[ruta] = original;
    else delete cjs.cache[ruta];
  }
}

beforeEach(() => {
  respaldo = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]));
  for (const v of VARIABLES) delete process.env[v];
  // Que un backend/.env local no cambie el resultado de la prueba
  vi.spyOn(dotenv, 'config').mockReturnValue({ parsed: {} });
  constructor = vi.spyOn(sequelizePkg, 'Sequelize').mockImplementation(function FalsoSequelize(...args) {
    this.args = args;
  });
});

afterEach(() => {
  for (const v of VARIABLES) {
    if (respaldo[v] === undefined) delete process.env[v];
    else process.env[v] = respaldo[v];
  }
});

describe('config/database.js', () => {
  it('con DATABASE_URL usa la URL completa, PostgreSQL y SSL obligatorio', () => {
    process.env.DATABASE_URL = 'postgres://usuario:clave@db.ejemplo:5432/base';

    const { instancia, args } = cargarConfig();

    expect(args).toHaveLength(2);
    const [url, opciones] = args;
    expect(url).toBe('postgres://usuario:clave@db.ejemplo:5432/base');
    expect(opciones).toEqual({
      dialect: 'postgres',
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
      logging: false,
      pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    });
    expect(instancia.args).toEqual(args);
  });

  it.each([
    ['sin la variable', undefined, false],
    ['con "false"', 'false', false],
    ['con un valor no reconocido', 'si', false],
    ['con "true"', 'true', true],
  ])('DB_SSL_REJECT_UNAUTHORIZED %s → rejectUnauthorized %s', (_c, valor, esperado) => {
    process.env.DATABASE_URL = 'postgres://u:c@h/b';
    if (valor !== undefined) process.env.DB_SSL_REJECT_UNAUTHORIZED = valor;

    const { args } = cargarConfig();

    expect(args[1].dialectOptions.ssl).toEqual({ require: true, rejectUnauthorized: esperado });
  });

  it('sin DATABASE_URL usa las variables sueltas DB_*', () => {
    Object.assign(process.env, {
      DB_NAME: 'BaseLocal',
      DB_USER: 'postgres',
      DB_PASSWORD: 'clave-local',
      DB_HOST: 'db',
      DB_PORT: '6543',
    });

    const { args } = cargarConfig();

    expect(args).toEqual([
      'BaseLocal',
      'postgres',
      'clave-local',
      {
        host: 'db',
        port: 6543,
        dialect: 'postgres',
        logging: false,
        pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
      },
    ]);
  });

  it('sin variables usa los valores por defecto (MedicalInventary, localhost, 5432)', () => {
    const { args } = cargarConfig();

    const [nombre, usuario, clave, opciones] = args;
    expect(nombre).toBe('MedicalInventary');
    expect(usuario).toBeUndefined();
    expect(clave).toBeUndefined();
    expect(opciones).toMatchObject({ host: 'localhost', port: 5432 });
  });

  it('un DB_PORT no numérico cae al puerto 5432', () => {
    process.env.DB_PORT = 'no-es-un-numero';

    const { args } = cargarConfig();

    expect(args[3].port).toBe(5432);
  });

  it.each([
    ['con DATABASE_URL', { DATABASE_URL: 'postgres://u:c@h/b' }, 1],
    ['con variables sueltas', {}, 3],
  ])('en development registra el SQL en consola (%s)', (_caso, env, indiceOpciones) => {
    Object.assign(process.env, env, { NODE_ENV: 'development' });

    const { args } = cargarConfig();

    expect(args[indiceOpciones].logging).toBe(console.log);
  });
});
