#!/usr/bin/env node
/**
 * Prueba de saturación (stress / load ramp) del backend de MedicalInventary.
 *
 * Sube la cantidad de conexiones concurrentes por etapas sobre varios endpoints
 * y detecta el punto de saturación: la primera etapa donde el porcentaje de
 * errores o la latencia p99 superan los umbrales configurados.
 *
 * REQUISITOS: el servidor debe estar corriendo contra una base de datos con los
 * datos semilla (npm run db:init y npm run db:seed-admin). Usar SIEMPRE una base
 * de pruebas, nunca la de producción.
 *
 * USO:   npm run test:saturacion
 *
 * VARIABLES DE ENTORNO (todas opcionales):
 *   SAT_URL            URL base del servidor            (http://localhost:4000)
 *   SAT_USER / SAT_PASS  credenciales de un admin       (Administrador01 / Administrador01*)
 *   SAT_DURATION       segundos por etapa               (8)
 *   SAT_STAGES         conexiones por etapa             (10,25,50,100,200,400)
 *   SAT_LOGIN_STAGES   etapas del escenario de login    (2,5,10,25,50)
 *   SAT_MAX_ERROR_PCT  % de errores tolerado            (1)
 *   SAT_MAX_P99_MS     latencia p99 tolerada en ms      (2000)
 *   SAT_TARGET_CONN    conexiones que el sistema debe soportar sin saturarse (25)
 *                      (el sistema tiene 20 ambulancias + 2 admins = 22 usuarios)
 *                      → si algún escenario se satura a ese nivel o antes, sale con código 1
 */
const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

const cfg = {
  url: (process.env.SAT_URL || 'http://localhost:4000').replace(/\/$/, ''),
  user: process.env.SAT_USER || 'Administrador01',
  pass: process.env.SAT_PASS || 'Administrador01*',
  duration: parseInt(process.env.SAT_DURATION, 10) || 8,
  stages: (process.env.SAT_STAGES || '10,25,50,100,200,400').split(',').map(Number),
  loginStages: (process.env.SAT_LOGIN_STAGES || '2,5,10,25,50').split(',').map(Number),
  maxErrorPct: parseFloat(process.env.SAT_MAX_ERROR_PCT ?? '1'),
  maxP99: parseInt(process.env.SAT_MAX_P99_MS, 10) || 2000,
  targetConn: parseInt(process.env.SAT_TARGET_CONN, 10) || 25, // 20 ambulancias + 2 admins = 22 usuarios + margen
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(method, ruta, { body, token } = {}) {
  const res = await fetch(cfg.url + ruta, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sin cuerpo JSON */ }
  return { status: res.status, data };
}

function ejecutarEtapa(escenario, conexiones, token) {
  return new Promise((resolve, reject) => {
    const opciones = {
      url: cfg.url + escenario.ruta,
      method: escenario.metodo || 'GET',
      connections: conexiones,
      duration: cfg.duration,
      timeout: 10,
      headers: {
        ...(escenario.auth ? { authorization: `Bearer ${token}` } : {}),
        ...(escenario.body ? { 'content-type': 'application/json' } : {}),
      },
      body: escenario.body ? JSON.stringify(escenario.body) : undefined,
    };
    autocannon(opciones, (err, r) => (err ? reject(err) : resolve(r)));
  });
}

function resumir(conexiones, r) {
  const total = r.requests.total || 0;
  const fallos = (r.errors || 0) + (r.timeouts || 0) + (r.non2xx || 0);
  const pctError = total + (r.errors || 0) + (r.timeouts || 0) > 0
    ? (fallos / (total + (r.errors || 0) + (r.timeouts || 0))) * 100
    : 100;
  return {
    conexiones,
    rps: Math.round(r.requests.average),
    p50: r.latency.p50,
    p97_5: r.latency.p97_5,
    p99: r.latency.p99,
    max: r.latency.max,
    solicitudes: total,
    exitosas2xx: r['2xx'] || 0,
    non2xx: r.non2xx || 0,
    errores: r.errors || 0,
    timeouts: r.timeouts || 0,
    pctError: Number(pctError.toFixed(2)),
  };
}

function saturada(e) {
  return e.pctError > cfg.maxErrorPct || e.p99 > cfg.maxP99;
}

const fmt = (n, w) => String(n).padStart(w);

function imprimirTabla(nombre, etapas) {
  console.log(`\n▶ ${nombre}`);
  console.log('  conex |   req/s |  p50 ms | p97.5 ms |  p99 ms | max ms | non2xx | err+timeout | %error | estado');
  for (const e of etapas) {
    const estado = saturada(e) ? '⚠ SATURADO' : 'OK';
    console.log(
      `  ${fmt(e.conexiones, 5)} | ${fmt(e.rps, 7)} | ${fmt(e.p50, 7)} | ${fmt(e.p97_5, 8)} | ` +
      `${fmt(e.p99, 7)} | ${fmt(e.max, 6)} | ${fmt(e.non2xx, 6)} | ${fmt(e.errores + e.timeouts, 11)} | ` +
      `${fmt(e.pctError, 6)} | ${estado}`,
    );
  }
}

async function main() {
  console.log('=== Prueba de saturación · MedicalInventary ===');
  console.log(`Servidor: ${cfg.url} | ${cfg.duration}s por etapa | umbrales: error > ${cfg.maxErrorPct}% o p99 > ${cfg.maxP99} ms`);

  // ── Verificaciones previas ────────────────────────────────────────────────
  let salud;
  try {
    salud = await http('GET', '/api/health');
  } catch (e) {
    console.error(`✗ No se pudo conectar con ${cfg.url}. ¿Está corriendo el servidor? (${e.message})`);
    process.exit(2);
  }
  if (salud.status !== 200) {
    console.error(`✗ /api/health respondió ${salud.status}`);
    process.exit(2);
  }

  const login = await http('POST', '/api/auth/login', {
    body: { numero_ambulancia: cfg.user, password: cfg.pass },
  });
  if (login.status !== 200 || !login.data?.token) {
    console.error(`✗ No se pudo iniciar sesión como ${cfg.user} (HTTP ${login.status}). ` +
      'Ejecuta npm run db:init y npm run db:seed-admin, o define SAT_USER / SAT_PASS.');
    process.exit(2);
  }
  const token = login.data.token;
  console.log(`✓ Servidor activo y sesión iniciada como ${cfg.user}`);

  const escenarios = [
    { id: 'health',   nombre: 'GET /api/health (sin base de datos)',            ruta: '/api/health', etapas: cfg.stages },
    { id: 'centros',  nombre: 'GET /api/centros-asistenciales (lectura BD, pública)', ruta: '/api/centros-asistenciales', etapas: cfg.stages },
    { id: 'insumos',  nombre: 'GET /api/insumos (lectura BD con JOIN, autenticada)', ruta: '/api/insumos', auth: true, etapas: cfg.stages },
    { id: 'historial', nombre: 'GET /api/reportes/admin/historial (consulta SQL pesada)', ruta: '/api/reportes/admin/historial', auth: true, etapas: cfg.stages },
    {
      id: 'login', nombre: 'POST /api/auth/login (bcrypt + escritura en BD)', ruta: '/api/auth/login', metodo: 'POST',
      body: { numero_ambulancia: cfg.user, password: cfg.pass }, etapas: cfg.loginStages,
    },
  ];

  const resultados = [];
  for (const esc of escenarios) {
    const etapas = [];
    for (const conexiones of esc.etapas) {
      process.stdout.write(`  · ${esc.id}: ${conexiones} conexiones...\r`);
      const r = await ejecutarEtapa(esc, conexiones, token);
      etapas.push(resumir(conexiones, r));
      await sleep(1500); // deja drenar el pool de conexiones antes de la siguiente etapa
    }
    imprimirTabla(esc.nombre, etapas);

    const primera = etapas.find(saturada);
    const mejor = etapas.reduce((a, b) => (b.rps > a.rps ? b : a), etapas[0]);
    resultados.push({
      id: esc.id,
      nombre: esc.nombre,
      etapas,
      puntoSaturacion: primera ? primera.conexiones : null,
      maxRps: mejor.rps,
      conexionesMaxRps: mejor.conexiones,
    });
  }

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n=== RESUMEN ===');
  let falla = false;
  for (const r of resultados) {
    const sat = r.puntoSaturacion;
    const cumple = sat === null || sat > cfg.targetConn;
    if (!cumple) falla = true;
    console.log(
      `${cumple ? '✓' : '✗'} ${r.id.padEnd(9)} máx ${fmt(r.maxRps, 6)} req/s (a ${r.conexionesMaxRps} conex.) · ` +
      `saturación: ${sat === null ? `no alcanzada hasta ${r.etapas.at(-1).conexiones} conex.` : `${sat} conex.`}`,
    );
  }
  console.log(`\nCriterio: soportar ${cfg.targetConn} conexiones concurrentes sin saturarse → ${falla ? 'NO CUMPLE' : 'CUMPLE'}`);

  // ── Guardar resultados ────────────────────────────────────────────────────
  const dir = path.join(__dirname, 'resultados');
  fs.mkdirSync(dir, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  const salida = { fecha: new Date().toISOString(), config: cfg, resultados, cumple: !falla };
  fs.writeFileSync(path.join(dir, `saturacion-${sello}.json`), JSON.stringify(salida, null, 2));
  fs.writeFileSync(path.join(dir, 'ultimo.json'), JSON.stringify(salida, null, 2));
  console.log(`\nResultados guardados en tests/saturacion/resultados/saturacion-${sello}.json`);

  process.exit(falla ? 1 : 0);
}

main().catch((e) => {
  console.error('✗ Error inesperado:', e);
  process.exit(2);
});
