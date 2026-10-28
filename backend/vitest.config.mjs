import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      // lcov → coverage/lcov.info, lo lee SonarCloud (ver sonar-project.properties en la raíz).
      // Para Sonar usa `npm run test:coverage:sonar` (o `npm run coverage:sonar` en la raíz),
      // que además corrige las rutas del lcov.
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      // Solo el código de la aplicación que se prueba con pruebas unitarias
      include: [
        'src/app.js',
        'src/controllers/**',
        'src/middlewares/**',
        'src/routes/**',
        'src/models/**',
        // Configuración de multer: tiene lógica de seguridad (tipos de archivo y tamaño)
        'src/config/upload.js',
        'src/config/uploadEvidencia.js',
        // Elige la conexión según DATABASE_URL o las variables DB_*; se prueba con Sequelize simulado
        'src/config/database.js',
      ],
      // Mismas exclusiones que sonar.coverage.exclusions. La lista `include` ya deja fuera
      // estos archivos; se repiten aquí para que la intención quede explícita.
      exclude: [
        // Solo conecta a la base y arranca el servidor; la lógica está en app.js
        'src/index.js',
        // Migración que se corre a mano contra una base real
        'src/config/initDB.js',
        // Datos semilla que se corren a mano contra una base real
        'src/config/seed*.js',
        // Script de diagnóstico manual
        'src/config/diagnostico.js',
      ],
      // Si la cobertura baja de estos valores, `npm run test:coverage` falla
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
