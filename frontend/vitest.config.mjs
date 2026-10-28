import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // Las páginas de Next usan JSX dentro de archivos .js
  plugins: [react({ include: /\.(js|jsx)$/ })],
  oxc: {
    include: /\.(js|jsx)$/,
    exclude: /node_modules/,
    lang: 'jsx',
  },
  resolve: {
    // Mismo alias que jsconfig.json: "@/*" → "./*"
    alias: { '@': raiz },
  },
  test: {
    environment: 'jsdom',
    // Zona horaria fija (la de la operación) para que las fechas por defecto no dependan del equipo
    env: { TZ: 'America/Bogota' },
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['tests/setup.js'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      // lcov → coverage/lcov.info, lo lee SonarCloud. Las rutas se corrigen con
      // `node ../scripts/fix-lcov-paths.mjs frontend` (lo hace `npm run test:coverage:sonar`,
      // o `npm run coverage:sonar` en la raíz para backend y frontend juntos).
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['app/**/*.{js,jsx}'],
      exclude: [
        // Solo envuelve <html>/<body> e importa globals.css; no tiene lógica que probar
        'app/layout.js',
        // Estilos y recursos estáticos (no son código JavaScript)
        'app/**/*.css',
        'app/favicon.ico',
        'public/**',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
