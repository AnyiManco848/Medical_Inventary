// Se ejecuta antes de cada archivo de prueba del frontend.
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { webcrypto } from 'node:crypto';

// La URL de la API sale del valor por defecto de cada página (http://localhost:4000)
delete process.env.NEXT_PUBLIC_API_URL;

// jsdom no implementa <canvas>: contexto 2D falso para el fondo animado del login
const contexto2d = new Proxy({}, {
  get: (obj, prop) => {
    if (!(prop in obj)) obj[prop] = vi.fn();
    return obj[prop];
  },
  set: (obj, prop, valor) => { obj[prop] = valor; return true; },
});
HTMLCanvasElement.prototype.getContext = function getContext() { return contexto2d; };

// Las animaciones no deben seguir corriendo entre pruebas: un solo cuadro y se detiene
window.requestAnimationFrame = () => 1;
window.cancelAnimationFrame = () => {};

// jsdom no implementa estas APIs del navegador que usan algunas páginas
window.scrollTo = () => {};
if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
}
if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:prueba';
if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};

// jsdom no trae crypto.subtle: se usa el WebCrypto de Node (el login cifra la contraseña con RSA-OAEP)
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

afterEach(() => {
  cleanup();
});
