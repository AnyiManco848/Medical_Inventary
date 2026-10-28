// Se mantiene por compatibilidad con `node scripts/fix-lcov-paths.mjs` desde backend/.
// La lógica vive en el script de la raíz, que corrige tanto el lcov del backend como el del frontend:
// ../../scripts/fix-lcov-paths.mjs
process.argv.splice(2, process.argv.length, 'backend');
await import('../../scripts/fix-lcov-paths.mjs');
