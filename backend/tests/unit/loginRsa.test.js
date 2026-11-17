import { describe, it, expect } from 'vitest';
import { cjs, cifrarParaLogin } from '../helpers.js';

const crypto = cjs('node:crypto');
const {
  crearClaves,
  obtenerClavePublica,
  descifrarPassword,
  VIGENCIA_MS,
  MENSAJE_INVALIDA,
  MENSAJE_VENCIDA,
} = cjs('../src/config/loginRsa');

const PASSWORD = 'Clave123*';

// Cifra un texto arbitrario con la clave pública del servidor (para probar contenidos mal formados)
function cifrarTexto(texto) {
  const clave = crypto.createPublicKey({ key: Buffer.from(obtenerClavePublica(), 'base64'), format: 'der', type: 'spki' });
  return crypto.publicEncrypt(
    { key: clave, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(texto),
  ).toString('base64');
}

describe('config/loginRsa · claves', () => {
  it('genera al arrancar una clave pública RSA de 2048 bits en SPKI base64 (sin cabeceras PEM)', () => {
    const publicKey = obtenerClavePublica();

    expect(publicKey).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(publicKey).not.toContain('BEGIN');
    const clave = crypto.createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });
    expect(clave.asymmetricKeyType).toBe('rsa');
    expect(clave.asymmetricKeyDetails.modulusLength).toBe(2048);
  });

  it('sin PEM genera un par nuevo cada vez', () => {
    expect(crearClaves('').publicKey).not.toBe(crearClaves('').publicKey);
  });

  it('usa la clave de LOGIN_RSA_PRIVATE_KEY (PEM), también con saltos de línea escritos como \\n', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const esperada = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

    expect(crearClaves(pem).publicKey).toBe(esperada);
    expect(crearClaves(pem.replaceAll('\n', String.raw`\n`)).publicKey).toBe(esperada);
  });

  it('la variable de entorno se lee por defecto', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const anterior = process.env.LOGIN_RSA_PRIVATE_KEY;
    process.env.LOGIN_RSA_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' });
    try {
      expect(crearClaves().publicKey).toBe(publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
    } finally {
      if (anterior === undefined) delete process.env.LOGIN_RSA_PRIVATE_KEY;
      else process.env.LOGIN_RSA_PRIVATE_KEY = anterior;
    }
  });

  it('rechaza una clave privada que no es RSA', () => {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });

    expect(() => crearClaves(pem)).toThrow('LOGIN_RSA_PRIVATE_KEY debe ser una clave privada RSA');
  });

  it('un PEM inválido hace fallar el arranque', () => {
    expect(() => crearClaves('no es un pem')).toThrow();
  });
});

describe('config/loginRsa · descifrarPassword', () => {
  it('descifra correctamente un mensaje reciente', () => {
    expect(descifrarPassword(cifrarParaLogin(PASSWORD))).toEqual({ password: PASSWORD });
  });

  it('acepta contraseñas con caracteres no ASCII', () => {
    expect(descifrarPassword(cifrarParaLogin('Contraseña#ñ€'))).toEqual({ password: 'Contraseña#ñ€' });
  });

  it('rechaza un ts con más de 2 minutos de antigüedad', () => {
    const cifrada = cifrarParaLogin(PASSWORD, { ts: Date.now() - VIGENCIA_MS - 1000 });

    expect(descifrarPassword(cifrada)).toEqual({ error: MENSAJE_VENCIDA });
  });

  it('acepta un ts justo dentro de la ventana y rechaza uno del futuro lejano', () => {
    const ahora = Date.now();
    const reciente = cifrarParaLogin(PASSWORD, { ts: ahora - VIGENCIA_MS + 1000 });
    const futuro = cifrarParaLogin(PASSWORD, { ts: ahora + VIGENCIA_MS + 1000 });

    expect(descifrarPassword(reciente, { ahora })).toEqual({ password: PASSWORD });
    expect(descifrarPassword(futuro, { ahora })).toEqual({ error: MENSAJE_VENCIDA });
  });

  it.each([
    ['texto que no es base64', 'esto no es base64!'],
    ['cadena vacía', ''],
    ['un número', 12345],
    ['un objeto', { password: PASSWORD }],
    ['base64 válido pero no cifrado con la clave', Buffer.from('hola mundo').toString('base64')],
  ])('rechaza %s', (_caso, valor) => {
    expect(descifrarPassword(valor)).toEqual({ error: MENSAJE_INVALIDA });
  });

  it('rechaza un mensaje cifrado con otra clave pública', () => {
    const otra = crearClaves('').publicKey;

    expect(descifrarPassword(cifrarParaLogin(PASSWORD, { publicKey: otra }))).toEqual({ error: MENSAJE_INVALIDA });
  });

  it('descifra con la clave privada indicada', () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const claves = crearClaves(privateKey.export({ type: 'pkcs8', format: 'pem' }));
    const cifrada = cifrarParaLogin(PASSWORD, { publicKey: claves.publicKey });

    expect(descifrarPassword(cifrada, { clavePrivada: claves.privateKey })).toEqual({ password: PASSWORD });
  });

  it.each([
    ['JSON sin password', { ts: 0 }],
    ['password vacía', { password: '', ts: 0 }],
    ['password no textual', { password: 123, ts: 0 }],
    ['ts no numérico', { password: PASSWORD, ts: 'ayer' }],
  ])('rechaza el %s', (_caso, contenido) => {
    const ahora = Date.now();
    const datos = typeof contenido.ts === 'number' ? { ...contenido, ts: ahora } : contenido;

    expect(descifrarPassword(cifrarTexto(JSON.stringify(datos)), { ahora })).toEqual({ error: MENSAJE_INVALIDA });
  });

  it('rechaza un texto descifrado que no es JSON', () => {
    expect(descifrarPassword(cifrarTexto('Clave123* en claro'))).toEqual({ error: MENSAJE_INVALIDA });
  });

  it('rechaza un JSON que no es un objeto', () => {
    expect(descifrarPassword(cifrarTexto('null'))).toEqual({ error: MENSAJE_INVALIDA });
  });
});
