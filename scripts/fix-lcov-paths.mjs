// Corrige las rutas SF: de los lcov.info de backend y frontend para SonarQube Cloud.
// Vitest las escribe relativas a cada paquete (y con "\" en Windows): "src\app.js", "app\login\page.js".
// Sonar se ejecuta desde la raíz del repo y espera "backend/src/app.js" y "frontend/app/login/page.js".
// Después comprueba que cada ruta existe en disco y está dentro de la carpeta de fuentes del paquete;
// si alguna falla (o falta el lcov), sale con código 1.
//
// Uso (desde la raíz):      node scripts/fix-lcov-paths.mjs [backend] [frontend]   (sin argumentos: ambos)
// Desde un paquete:         node ../scripts/fix-lcov-paths.mjs frontend
// Es idempotente: se puede correr varias veces sobre el mismo lcov.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Paquete → carpeta de fuentes que Sonar analiza (sonar.sources)
const PAQUETES = {
  backend:  'backend/src',
  frontend: 'frontend/app',
};

const pedidos = process.argv.slice(2);
const desconocidos = pedidos.filter((p) => !(p in PAQUETES));
if (desconocidos.length) {
  console.error(`[lcov] Paquete desconocido: ${desconocidos.join(', ')}. Usa: ${Object.keys(PAQUETES).join(' | ')}`);
  process.exit(1);
}
const paquetes = pedidos.length ? pedidos : Object.keys(PAQUETES);

// Convierte una ruta del lcov en ruta relativa a la raíz del repo, con "/".
// Una ruta ya corregida ("backend/src/...") se deja igual.
function aRutaDelRepo(ruta, paquete) {
  const normalizada = ruta.replace(/\\/g, '/');
  let absoluta;
  if (path.isAbsolute(ruta) || path.isAbsolute(normalizada)) {
    absoluta = path.resolve(ruta);
  } else if (normalizada.startsWith(`${paquete}/`)) {
    absoluta = path.resolve(repoRoot, normalizada);
  } else {
    absoluta = path.resolve(repoRoot, paquete, normalizada);
  }
  return path.relative(repoRoot, absoluta).split(path.sep).join('/');
}

function corregir(paquete) {
  const fuentes = PAQUETES[paquete];
  const lcovRel = `${paquete}/coverage/lcov.info`;
  const lcovPath = path.join(repoRoot, lcovRel);

  if (!existsSync(lcovPath)) {
    console.error(`[lcov] No existe ${lcovRel}. Ejecuta antes: npm --prefix ${paquete} run test:coverage`);
    return false;
  }

  const rutas = [];
  const corregidas = readFileSync(lcovPath, 'utf8').split(/\r?\n/).map((linea) => {
    if (!linea.startsWith('SF:')) return linea;
    const ruta = aRutaDelRepo(linea.slice(3), paquete);
    rutas.push(ruta);
    return `SF:${ruta}`;
  });
  writeFileSync(lcovPath, corregidas.join('\n'));

  // Chequeo: cada SF: debe existir relativo a la raíz del repo y estar dentro de la carpeta de fuentes
  const faltan = rutas.filter((r) => !existsSync(path.join(repoRoot, r)));
  const fuera = rutas.filter((r) => !r.startsWith(`${fuentes}/`));

  console.log(`[lcov] ${lcovRel}: ${rutas.length} archivos`);
  for (const r of rutas) {
    const ok = !faltan.includes(r) && !fuera.includes(r);
    console.log(`  ${ok ? 'OK   ' : 'FALLA'} ${r}`);
  }

  if (rutas.length === 0) console.error(`[lcov] ${lcovRel} no tiene ninguna ruta SF:`);
  if (faltan.length) console.error(`[lcov] ${faltan.length} ruta(s) no existen en disco`);
  if (fuera.length) console.error(`[lcov] ${fuera.length} ruta(s) fuera de ${fuentes}/`);
  return rutas.length > 0 && !faltan.length && !fuera.length;
}

const resultados = paquetes.map(corregir);
if (resultados.includes(false)) process.exit(1);
console.log(`[lcov] Todas las rutas existen y están bajo ${paquetes.map((p) => `${PAQUETES[p]}/`).join(' y ')}`);
