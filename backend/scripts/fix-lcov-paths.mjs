// Corrige las rutas SF: de coverage/lcov.info para SonarCloud.
// Vitest las escribe relativas a backend/ (y con "\" en Windows): "src\app.js".
// Sonar se ejecuta desde la raíz del repo y espera "backend/src/app.js".
// Después comprueba que cada ruta existe en disco; si alguna no existe, sale con código 1.
//
// Uso (desde backend/): node scripts/fix-lcov-paths.mjs [ruta/al/lcov.info]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(backendDir, '..');
const lcovPath = path.resolve(process.argv[2] ?? path.join(backendDir, 'coverage', 'lcov.info'));

if (!existsSync(lcovPath)) {
  console.error(`[lcov] No existe ${lcovPath}. Ejecuta antes: npm run test:coverage`);
  process.exit(1);
}

// Convierte una ruta del lcov en ruta relativa a la raíz del repo, con "/".
// Es idempotente: una ruta ya corregida ("backend/src/...") se deja igual.
function aRutaDelRepo(ruta) {
  const normalizada = ruta.replace(/\\/g, '/');
  let absoluta;
  if (path.isAbsolute(ruta) || path.isAbsolute(normalizada)) {
    absoluta = path.resolve(ruta);
  } else if (normalizada.startsWith('backend/')) {
    absoluta = path.resolve(repoRoot, normalizada);
  } else {
    absoluta = path.resolve(backendDir, normalizada);
  }
  return path.relative(repoRoot, absoluta).split(path.sep).join('/');
}

const lineas = readFileSync(lcovPath, 'utf8').split(/\r?\n/);
const rutas = [];
const corregidas = lineas.map((linea) => {
  if (!linea.startsWith('SF:')) return linea;
  const ruta = aRutaDelRepo(linea.slice(3));
  rutas.push(ruta);
  return `SF:${ruta}`;
});
writeFileSync(lcovPath, corregidas.join('\n'));

// Chequeo: cada SF: debe existir relativo a la raíz del repo y estar dentro de backend/src
const faltan = rutas.filter((r) => !existsSync(path.join(repoRoot, r)));
const fuera = rutas.filter((r) => !r.startsWith('backend/src/'));

console.log(`[lcov] ${path.relative(repoRoot, lcovPath).split(path.sep).join('/')}: ${rutas.length} archivos`);
for (const r of rutas) {
  const ok = !faltan.includes(r) && !fuera.includes(r);
  console.log(`  ${ok ? 'OK   ' : 'FALLA'} ${r}`);
}

if (rutas.length === 0 || faltan.length || fuera.length) {
  if (rutas.length === 0) console.error('[lcov] El lcov no tiene ninguna ruta SF:');
  if (faltan.length) console.error(`[lcov] ${faltan.length} ruta(s) no existen en disco`);
  if (fuera.length) console.error(`[lcov] ${fuera.length} ruta(s) fuera de backend/src/`);
  process.exit(1);
}
console.log('[lcov] Todas las rutas existen y están bajo backend/src/');
