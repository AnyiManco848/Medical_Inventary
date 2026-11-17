// Cifrado híbrido de la contraseña del login (RSA-OAEP con SHA-256).
//
// IMPORTANTE: HTTPS (Caddy + HSTS) sigue siendo la protección real del transporte. Este cifrado
// solo evita que la contraseña aparezca legible en las herramientas del navegador (Network > Payload)
// y en cualquier punto intermedio que vea el cuerpo de la petición. No reemplaza a TLS.
//
// La clave privada vive solo en memoria: no se escribe en disco ni en logs. Para varias instancias
// detrás de un balanceador, todas deben compartir la misma clave mediante LOGIN_RSA_PRIVATE_KEY (PEM).
const crypto = require('node:crypto');

// Antigüedad máxima del campo ts del mensaje cifrado (también se rechaza si viene del futuro)
const VIGENCIA_MS = 2 * 60 * 1000;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const MENSAJE_INVALIDA = 'No se pudo descifrar la contraseña. Recargue la página e intente nuevamente.';
const MENSAJE_VENCIDA = 'La solicitud de inicio de sesión expiró. Intente nuevamente.';

// Crea el par de claves: usa el PEM recibido (o LOGIN_RSA_PRIVATE_KEY) o genera uno nuevo de 2048 bits.
// Acepta el PEM con saltos de línea reales o escritos como "\n" (formato habitual en archivos .env).
function crearClaves(pem = process.env.LOGIN_RSA_PRIVATE_KEY) {
  const privateKey = pem
    ? crypto.createPrivateKey(pem.replaceAll(String.raw`\n`, '\n'))
    : crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;

  if (privateKey.asymmetricKeyType !== 'rsa') {
    throw new Error('LOGIN_RSA_PRIVATE_KEY debe ser una clave privada RSA');
  }

  // SPKI en DER y base64, sin cabeceras PEM: es lo que espera crypto.subtle.importKey('spki', ...)
  const publicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).toString('base64');
  return { privateKey, publicKey };
}

// Se genera (o se carga) una sola vez, al arrancar el servidor
const claves = crearClaves();

function obtenerClavePublica() {
  return claves.publicKey;
}

// Descifra password_cifrada (base64 de RSA-OAEP/SHA-256 sobre {"password": "...", "ts": <epoch ms>}).
// Devuelve { password } si es válida o { error } con un mensaje para el usuario. Nunca lanza.
function descifrarPassword(cifrada, { clavePrivada = claves.privateKey, ahora = Date.now() } = {}) {
  if (typeof cifrada !== 'string' || !BASE64.test(cifrada)) {
    return { error: MENSAJE_INVALIDA };
  }

  let datos;
  try {
    const texto = crypto.privateDecrypt(
      { key: clavePrivada, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(cifrada, 'base64'),
    );
    datos = JSON.parse(texto.toString('utf8'));
  } catch {
    // No se propaga el error original: no debe terminar en ningún log
    return { error: MENSAJE_INVALIDA };
  }

  if (typeof datos?.password !== 'string' || datos.password === '' || !Number.isFinite(datos.ts)) {
    return { error: MENSAJE_INVALIDA };
  }
  if (Math.abs(ahora - datos.ts) > VIGENCIA_MS) {
    return { error: MENSAJE_VENCIDA };
  }
  return { password: datos.password };
}

module.exports = {
  crearClaves,
  obtenerClavePublica,
  descifrarPassword,
  VIGENCIA_MS,
  MENSAJE_INVALIDA,
  MENSAJE_VENCIDA,
};
