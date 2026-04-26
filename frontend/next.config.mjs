import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fija la raíz del workspace para Turbopack y evita el warning
  // por el package-lock.json en la carpeta padre
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
