'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Cookies from 'js-cookie';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const C = {
  bg:          '#f0f5f2',
  green:       '#2d8653',
  greenLight:  '#e8f3ed',
  greenBorder: '#b5d9c5',
  greenMid:    '#4a9e6e',
  teal:        '#2d7da8',
  tealLight:   '#e8f2f8',
  tealBorder:  '#b5d0e0',
  amber:       '#b45309',
  amberLight:  '#fef9ec',
  amberBorder: '#f0d9a0',
  textDark:    '#1a2e25',
  textMid:     '#4a6a57',
  textLight:   '#7a9e8a',
  cardBg:      '#ffffff',
  cardShadow:  '0 4px 32px rgba(45,134,83,0.10), 0 1px 4px rgba(0,0,0,0.06)',
  errorColor:  '#c0392b',
  errorBg:     '#fdf0ef',
  errorBorder: '#f0b8b3',
  navBorder:   '#d5e8dc',
};

function decodificarJWT(token) {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); }
  catch { return null; }
}

function formatFecha(f) {
  if (!f) return '—';
  const parts = String(f).split('-');
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return f;
}

function formatHora(h) {
  if (!h) return '—';
  return String(h).substring(0, 5);
}

function nombreCentro(row) {
  return row.centroOtro || row.centroNombre || '—';
}

const inputStyle = {
  width:           '100%',
  backgroundColor: C.greenLight,
  border:          `1px solid ${C.greenBorder}`,
  borderRadius:    '8px',
  padding:         '0.6rem 0.85rem',
  color:           C.textDark,
  fontSize:        '0.875rem',
  outline:         'none',
  boxSizing:       'border-box',
};

const selectStyle = {
  ...inputStyle,
  appearance:         'none',
  backgroundImage:    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234a6a57' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat:   'no-repeat',
  backgroundPosition: 'right 0.85rem center',
  paddingRight:       '2.25rem',
  cursor:             'pointer',
};

const labelStyle = {
  display:       'block',
  fontSize:      '0.78rem',
  fontWeight:    '600',
  color:         C.textMid,
  marginBottom:  '0.3rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const EcgIcon = () => (
  <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <polyline points="1,16 6,16 9,8 12,24 15,12 18,20 21,16 31,16"
      stroke="#2d8653" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

function EstadoBadge({ estado }) {
  const esRecuperado = estado === 'Recuperado';
  return (
    <span style={{
      display:         'inline-block',
      padding:         '0.2rem 0.55rem',
      borderRadius:    '6px',
      fontSize:        '0.76rem',
      fontWeight:      '600',
      backgroundColor: esRecuperado ? C.greenLight  : C.amberLight,
      color:           esRecuperado ? C.green        : C.amber,
      border:          `1px solid ${esRecuperado ? C.greenBorder : C.amberBorder}`,
      whiteSpace:      'nowrap',
    }}>
      {esRecuperado ? '✓ Recuperado' : '⏳ En centro'}
    </span>
  );
}

const FILTROS_INIT = { ambulanciaId: '', centroId: '', fechaDesde: '', fechaHasta: '', insumo: '' };
const FILTROS_P_INIT = { fechaDesde: '', fechaHasta: '' };

export default function ReportesAdminPage() {
  const router = useRouter();
  const [usuario,     setUsuario]     = useState(null);
  const [tabActiva,   setTabActiva]   = useState('historial');

  const [historial,   setHistorial]   = useState([]);
  const [cargandoH,   setCargandoH]   = useState(false);
  const [errorH,      setErrorH]      = useState('');
  const [filtros,     setFiltros]     = useState(FILTROS_INIT);

  const [pendientes,  setPendientes]  = useState([]);
  const [cargandoP,   setCargandoP]   = useState(false);
  const [errorP,      setErrorP]      = useState('');
  const [filtrosP,    setFiltrosP]    = useState(FILTROS_P_INIT);

  const [ambulancias, setAmbulancias] = useState([]);
  const [centros,     setCentros]     = useState([]);

  const [exportando,  setExportando]  = useState(false);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) { router.push('/login'); return; }

    const decoded = decodificarJWT(token);
    if (!decoded || (decoded.exp && Date.now() / 1000 > decoded.exp)) {
      Cookies.remove('token'); Cookies.remove('usuario');
      router.push('/login'); return;
    }
    if (decoded.rol !== 'admin') {
      router.push('/dashboard'); return;
    }

    try {
      const u = JSON.parse(Cookies.get('usuario') || '{}');
      setUsuario(u.id ? u : { numero_ambulancia: decoded.numero_ambulancia, rol: decoded.rol });
    } catch {
      setUsuario({ numero_ambulancia: decoded.numero_ambulancia, rol: decoded.rol });
    }
  }, [router]);

  useEffect(() => {
    if (!usuario) return;
    const token = Cookies.get('token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    axios.get(`${API}/api/ambulancias/activas`, { headers }).then(({ data }) => setAmbulancias(data)).catch(() => {});
    axios.get(`${API}/api/centros-asistenciales`).then(({ data }) => setCentros(data.filter(c => !c.esOtro))).catch(() => {});
  }, [usuario]);

  const cargarHistorial = useCallback((params) => {
    const token = Cookies.get('token');
    if (!token) return;
    setCargandoH(true);
    setErrorH('');
    const query = {};
    if (params.ambulanciaId) query.ambulanciaId = params.ambulanciaId;
    if (params.centroId)     query.centroId     = params.centroId;
    if (params.fechaDesde)   query.fechaDesde   = params.fechaDesde;
    if (params.fechaHasta)   query.fechaHasta   = params.fechaHasta;
    if (params.insumo)       query.insumo       = params.insumo;

    axios.get(`${API}/api/reportes/admin/historial`, {
      params: query,
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(({ data }) => setHistorial(data))
      .catch(() => setErrorH('No se pudo cargar el historial. Intente nuevamente.'))
      .finally(() => setCargandoH(false));
  }, []);

  const cargarPendientes = useCallback((params = {}) => {
    const token = Cookies.get('token');
    if (!token) return;
    setCargandoP(true);
    setErrorP('');
    const query = {};
    if (params.fechaDesde) query.fechaDesde = params.fechaDesde;
    if (params.fechaHasta) query.fechaHasta = params.fechaHasta;
    axios.get(`${API}/api/reportes/admin/pendientes`, {
      params: query,
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(({ data }) => setPendientes(data))
      .catch(() => setErrorP('No se pudo cargar los pendientes. Intente nuevamente.'))
      .finally(() => setCargandoP(false));
  }, []);

  useEffect(() => {
    if (!usuario) return;
    cargarHistorial(FILTROS_INIT);
    cargarPendientes();
  }, [usuario, cargarHistorial, cargarPendientes]);

  useEffect(() => {
    if (tabActiva === 'pendientes' && usuario) cargarPendientes();
  }, [tabActiva, usuario, cargarPendientes]);

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;
    setFiltros(f => ({ ...f, [name]: value }));
  };

  const handleAplicar   = () => cargarHistorial(filtros);
  const handleLimpiar   = () => { setFiltros(FILTROS_INIT); cargarHistorial(FILTROS_INIT); };

  const handleAplicarP  = () => cargarPendientes(filtrosP);
  const handleLimpiarP  = () => { setFiltrosP(FILTROS_P_INIT); cargarPendientes(); };

  /* ── Exportar PDF ─────────────────────────────────────────────── */
  const generarPDF = async (tipo) => {
    if (exportando) return;
    setExportando(true);
    try {
      const { default: jsPDF }         = await import('jspdf');
      const { default: autoTable }     = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const ahora = new Date().toLocaleString('es-CO');

      if (tipo === 'historial') {
        doc.setFontSize(14);
        doc.setTextColor(26, 46, 37);
        doc.text('Historial de movimientos de insumos', 14, 16);
        doc.setFontSize(9);
        doc.setTextColor(74, 106, 87);
        doc.text(`Generado: ${ahora}  |  ${historial.length} registro${historial.length !== 1 ? 's' : ''}`, 14, 23);

        autoTable(doc, {
          startY: 28,
          head: [['Insumo', 'Código', 'Centro asistencial', 'Ambulancia', 'Fecha', 'Hora', 'Entregó', 'Estado']],
          body: historial.map(r => [
            r.insumoNombre  || '—',
            r.codigoInsumo  || '—',
            nombreCentro(r),
            r.ambulanciaCodigo || '—',
            formatFecha(r.fecha),
            formatHora(r.hora),
            r.usuarioEntrega   || '—',
            r.estadoActual,
          ]),
          styles:            { fontSize: 8, cellPadding: 3 },
          headStyles:        { fillColor: [45, 134, 83], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles:{ fillColor: [232, 243, 237] },
        });
        doc.save(`historial-${new Date().toISOString().split('T')[0]}.pdf`);

      } else {
        doc.setFontSize(14);
        doc.setTextColor(26, 46, 37);
        doc.text('Insumos pendientes de recuperación', 14, 16);
        doc.setFontSize(9);
        doc.setTextColor(74, 106, 87);
        doc.text(`Generado: ${ahora}  |  ${pendientes.length} insumo${pendientes.length !== 1 ? 's' : ''} pendiente${pendientes.length !== 1 ? 's' : ''}`, 14, 23);

        autoTable(doc, {
          startY: 28,
          head: [['Insumo', 'Código', 'Centro asistencial', 'Fecha entregado', 'Hora', 'Ambulancia', 'Responsable']],
          body: pendientes.map(r => [
            r.insumoNombre  || '—',
            r.codigoInsumo  || '—',
            nombreCentro(r),
            formatFecha(r.fecha),
            formatHora(r.hora),
            r.ambulanciaCodigo || '—',
            r.usuarioNombre    || '—',
          ]),
          styles:            { fontSize: 8, cellPadding: 3 },
          headStyles:        { fillColor: [180, 83, 9], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles:{ fillColor: [254, 249, 236] },
        });
        doc.save(`pendientes-${new Date().toISOString().split('T')[0]}.pdf`);
      }
    } catch (e) {
      console.error('Error generando PDF:', e);
    } finally {
      setExportando(false);
    }
  };

  /* ── Exportar Excel ───────────────────────────────────────────── */
  const generarExcel = async (tipo) => {
    if (exportando) return;
    setExportando(true);
    try {
      const XLSX = (await import('xlsx')).default;

      if (tipo === 'historial') {
        const data = historial.map(r => ({
          'Insumo':             r.insumoNombre  || '—',
          'Código':             r.codigoInsumo  || '—',
          'Centro asistencial': nombreCentro(r),
          'Ambulancia':         r.ambulanciaCodigo || '—',
          'Fecha':              formatFecha(r.fecha),
          'Hora':               formatHora(r.hora),
          'Entregó':            r.usuarioEntrega   || '—',
          'Recuperó':           r.usuarioRecogida  || '—',
          'Estado':             r.estadoActual,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Historial');
        XLSX.writeFile(wb, `historial-${new Date().toISOString().split('T')[0]}.xlsx`);

      } else {
        const data = pendientes.map(r => ({
          'Insumo':             r.insumoNombre  || '—',
          'Código':             r.codigoInsumo  || '—',
          'Centro asistencial': nombreCentro(r),
          'Fecha entregado':    formatFecha(r.fecha),
          'Hora':               formatHora(r.hora),
          'Ambulancia':         r.ambulanciaCodigo || '—',
          'Responsable':        r.usuarioNombre    || '—',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Pendientes');
        XLSX.writeFile(wb, `pendientes-${new Date().toISOString().split('T')[0]}.xlsx`);
      }
    } catch (e) {
      console.error('Error generando Excel:', e);
    } finally {
      setExportando(false);
    }
  };

  if (!usuario) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.textMid }}>Cargando...</p>
      </div>
    );
  }

  const btnExport = (disabled) => ({
    display:         'inline-flex',
    alignItems:      'center',
    gap:             '0.35rem',
    backgroundColor: disabled ? '#e5e7eb' : C.greenLight,
    color:           disabled ? '#9ca3af' : C.textMid,
    border:          `1px solid ${disabled ? '#d1d5db' : C.greenBorder}`,
    borderRadius:    '8px',
    padding:         '0.5rem 0.95rem',
    cursor:          disabled ? 'not-allowed' : 'pointer',
    fontSize:        '0.82rem',
    fontWeight:      '600',
    transition:      'background-color 0.15s',
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ backgroundColor: C.cardBg, borderBottom: `1px solid ${C.navBorder}`, padding: '0.9rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 1px 4px rgba(45,134,83,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/dashboard" style={{ color: C.textMid, textDecoration: 'none', fontSize: '0.875rem' }}>← Dashboard</Link>
          <span style={{ color: C.greenBorder }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', backgroundColor: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: '8px' }}>
              <EcgIcon />
            </div>
            <span style={{ fontWeight: '700', fontSize: '1rem', color: C.textDark }}>
              Medical<span style={{ color: C.green }}>Inventary</span>
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.85rem', color: C.textDark, fontWeight: '600', lineHeight: '1.2', margin: 0 }}>{usuario.nombre || usuario.numero_ambulancia}</p>
          <p style={{ fontSize: '0.72rem', color: C.green, textTransform: 'capitalize', fontWeight: '500', margin: 0 }}>{usuario.rol}</p>
        </div>
      </header>

      <main style={{ padding: '2rem', maxWidth: '1300px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: '700', color: C.textDark, marginBottom: '0.25rem' }}>Reportes de trazabilidad</h1>
        <p style={{ color: C.textMid, fontSize: '0.875rem', marginBottom: '1.75rem' }}>
          Historial completo de movimientos de insumos e insumos pendientes de recuperar.
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: `2px solid ${C.greenBorder}` }}>
          {[['historial', '📋 Historial completo'], ['pendientes', '⏳ Pendientes de recuperar']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTabActiva(id)}
              style={{
                padding:         '0.6rem 1.25rem',
                border:          'none',
                borderBottom:    `2px solid ${tabActiva === id ? C.green : 'transparent'}`,
                marginBottom:    '-2px',
                backgroundColor: 'transparent',
                color:           tabActiva === id ? C.green : C.textMid,
                fontWeight:      tabActiva === id ? '700' : '500',
                fontSize:        '0.9rem',
                cursor:          'pointer',
                transition:      'color 0.15s',
              }}
            >
              {label}
              {id === 'pendientes' && pendientes.length > 0 && (
                <span style={{ marginLeft: '0.4rem', backgroundColor: C.amber, color: '#fff', borderRadius: '10px', padding: '0.05rem 0.45rem', fontSize: '0.72rem', fontWeight: '700' }}>
                  {pendientes.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Pestaña Historial ─────────────────────────────────────── */}
        {tabActiva === 'historial' && (
          <>
            {/* Panel de filtros */}
            <div style={{ backgroundColor: C.cardBg, border: `1px solid ${C.greenBorder}`, borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '1.25rem', boxShadow: C.cardShadow }}>
              <p style={{ fontSize: '0.78rem', fontWeight: '600', color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>Filtros</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>

                <div>
                  <label style={labelStyle}>Ambulancia</label>
                  <select name="ambulanciaId" value={filtros.ambulanciaId} onChange={handleFiltroChange} style={selectStyle}>
                    <option value="">Todas</option>
                    {ambulancias.map(a => (
                      <option key={a.id} value={a.id}>{a.codigo}{a.descripcion ? ` — ${a.descripcion}` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Centro asistencial</label>
                  <select name="centroId" value={filtros.centroId} onChange={handleFiltroChange} style={selectStyle}>
                    <option value="">Todos</option>
                    {centros.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Insumo</label>
                  <input
                    type="text"
                    name="insumo"
                    value={filtros.insumo}
                    onChange={handleFiltroChange}
                    placeholder="Nombre o código..."
                    style={inputStyle}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAplicar(); }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Fecha desde</label>
                  <input type="date" name="fechaDesde" value={filtros.fechaDesde} onChange={handleFiltroChange} style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Fecha hasta</label>
                  <input type="date" name="fechaHasta" value={filtros.fechaHasta} onChange={handleFiltroChange} style={inputStyle} />
                </div>

              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleAplicar}
                  disabled={cargandoH}
                  style={{ backgroundColor: C.green, color: '#fff', border: 'none', borderRadius: '8px', padding: '0.55rem 1.25rem', cursor: cargandoH ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.875rem', opacity: cargandoH ? 0.7 : 1 }}
                >
                  {cargandoH ? 'Buscando...' : 'Aplicar filtros'}
                </button>
                <button
                  type="button"
                  onClick={handleLimpiar}
                  disabled={cargandoH}
                  style={{ backgroundColor: C.greenLight, color: C.textMid, border: `1px solid ${C.greenBorder}`, borderRadius: '8px', padding: '0.55rem 1rem', cursor: cargandoH ? 'not-allowed' : 'pointer', fontWeight: '500', fontSize: '0.875rem' }}
                >
                  Limpiar
                </button>

                {historial.length > 0 && (
                  <>
                    <span style={{ width: '1px', height: '24px', backgroundColor: C.greenBorder, margin: '0 0.2rem' }} />
                    <button
                      type="button"
                      onClick={() => generarPDF('historial')}
                      disabled={exportando}
                      style={btnExport(exportando)}
                    >
                      📄 {exportando ? 'Exportando...' : 'PDF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => generarExcel('historial')}
                      disabled={exportando}
                      style={btnExport(exportando)}
                    >
                      📊 {exportando ? 'Exportando...' : 'Excel'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {errorH && (
              <div style={{ backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '10px', padding: '0.9rem 1.25rem', marginBottom: '1.25rem', color: C.errorColor, fontSize: '0.875rem' }}>
                {errorH}
              </div>
            )}

            {/* Tabla historial */}
            <div style={{ backgroundColor: C.cardBg, border: `1px solid ${C.greenBorder}`, borderRadius: '12px', boxShadow: C.cardShadow, overflow: 'hidden' }}>
              {cargandoH ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight, fontSize: '0.9rem' }}>Cargando historial...</div>
              ) : historial.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight, fontSize: '0.9rem' }}>No se encontraron registros con los filtros aplicados.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.835rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: C.greenLight, borderBottom: `2px solid ${C.greenBorder}` }}>
                        {['Insumo', 'Centro asistencial', 'Ambulancia', 'Fecha y hora', 'Entregó', 'Recuperó', 'Estado'].map(col => (
                          <th key={col} style={{ padding: '0.7rem 0.9rem', textAlign: 'left', fontWeight: '600', color: C.textDark, whiteSpace: 'nowrap', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map((r, idx) => (
                        <tr key={r.id} style={{ borderBottom: `1px solid ${C.greenBorder}`, backgroundColor: idx % 2 === 0 ? '#fff' : '#fafcfb' }}>
                          <td style={{ padding: '0.7rem 0.9rem', color: C.textDark, maxWidth: '200px' }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{r.insumoNombre || '—'}</div>
                            {r.codigoInsumo && (
                              <div style={{ fontSize: '0.72rem', color: C.textLight, fontFamily: 'monospace' }}>{r.codigoInsumo}</div>
                            )}
                          </td>
                          <td style={{ padding: '0.7rem 0.9rem', color: C.textMid, maxWidth: '180px' }}>{nombreCentro(r)}</td>
                          <td style={{ padding: '0.7rem 0.9rem', color: C.textMid, whiteSpace: 'nowrap' }}>{r.ambulanciaCodigo || '—'}</td>
                          <td style={{ padding: '0.7rem 0.9rem', color: C.textMid, whiteSpace: 'nowrap' }}>
                            <div>{formatFecha(r.fecha)}</div>
                            <div style={{ fontSize: '0.74rem', color: C.textLight }}>{formatHora(r.hora)}</div>
                          </td>
                          <td style={{ padding: '0.7rem 0.9rem', color: C.textMid }}>{r.usuarioEntrega || '—'}</td>
                          <td style={{ padding: '0.7rem 0.9rem', color: C.textMid }}>{r.usuarioRecogida || '—'}</td>
                          <td style={{ padding: '0.7rem 0.9rem' }}>
                            <EstadoBadge estado={r.estadoActual} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!cargandoH && historial.length > 0 && (
                <div style={{ padding: '0.6rem 1rem', borderTop: `1px solid ${C.greenBorder}`, backgroundColor: C.greenLight, fontSize: '0.78rem', color: C.textLight, textAlign: 'right' }}>
                  {historial.length} registro{historial.length !== 1 ? 's' : ''}{historial.length === 200 ? ' (máximo mostrado — aplica filtros para acotar)' : ''}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Pestaña Pendientes ────────────────────────────────────── */}
        {tabActiva === 'pendientes' && (
          <>
            {/* Filtros de fecha */}
            <div style={{ backgroundColor: C.cardBg, border: `1px solid ${C.greenBorder}`, borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '1.25rem', boxShadow: C.cardShadow }}>
              <p style={{ fontSize: '0.78rem', fontWeight: '600', color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>Filtros</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Fecha desde</label>
                  <input
                    type="date"
                    value={filtrosP.fechaDesde}
                    onChange={e => setFiltrosP(f => ({ ...f, fechaDesde: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Fecha hasta</label>
                  <input
                    type="date"
                    value={filtrosP.fechaHasta}
                    onChange={e => setFiltrosP(f => ({ ...f, fechaHasta: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleAplicarP}
                  disabled={cargandoP}
                  style={{ backgroundColor: C.green, color: '#fff', border: 'none', borderRadius: '8px', padding: '0.55rem 1.25rem', cursor: cargandoP ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.875rem', opacity: cargandoP ? 0.7 : 1 }}
                >
                  {cargandoP ? 'Buscando...' : 'Aplicar filtros'}
                </button>
                <button
                  type="button"
                  onClick={handleLimpiarP}
                  disabled={cargandoP}
                  style={{ backgroundColor: C.greenLight, color: C.textMid, border: `1px solid ${C.greenBorder}`, borderRadius: '8px', padding: '0.55rem 1rem', cursor: cargandoP ? 'not-allowed' : 'pointer', fontWeight: '500', fontSize: '0.875rem' }}
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => cargarPendientes(filtrosP)}
                  disabled={cargandoP}
                  style={{ backgroundColor: C.greenLight, color: C.textMid, border: `1px solid ${C.greenBorder}`, borderRadius: '8px', padding: '0.45rem 0.9rem', cursor: cargandoP ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: '500' }}
                >
                  {cargandoP ? 'Actualizando...' : '↺ Actualizar'}
                </button>

                {pendientes.length > 0 && (
                  <>
                    <span style={{ width: '1px', height: '24px', backgroundColor: C.greenBorder, margin: '0 0.2rem' }} />
                    <button
                      type="button"
                      onClick={() => generarPDF('pendientes')}
                      disabled={exportando}
                      style={btnExport(exportando)}
                    >
                      📄 {exportando ? 'Exportando...' : 'PDF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => generarExcel('pendientes')}
                      disabled={exportando}
                      style={btnExport(exportando)}
                    >
                      📊 {exportando ? 'Exportando...' : 'Excel'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {errorP && (
              <div style={{ backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '10px', padding: '0.9rem 1.25rem', marginBottom: '1.25rem', color: C.errorColor, fontSize: '0.875rem' }}>
                {errorP}
              </div>
            )}

            <div style={{ backgroundColor: C.cardBg, border: `1px solid ${C.greenBorder}`, borderRadius: '12px', boxShadow: C.cardShadow, overflow: 'hidden' }}>
              {cargandoP ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight, fontSize: '0.9rem' }}>Cargando pendientes...</div>
              ) : pendientes.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <p style={{ color: C.green, fontWeight: '600', fontSize: '0.95rem', marginBottom: '0.4rem' }}>✓ Sin pendientes</p>
                  <p style={{ color: C.textLight, fontSize: '0.875rem' }}>Todos los insumos entregados han sido recuperados.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.835rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: C.amberLight, borderBottom: `2px solid ${C.amberBorder}` }}>
                        {['Insumo', 'Centro asistencial', 'Fecha entregado', 'Ambulancia', 'Usuario responsable'].map(col => (
                          <th key={col} style={{ padding: '0.7rem 0.9rem', textAlign: 'left', fontWeight: '600', color: C.amber, whiteSpace: 'nowrap', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pendientes.map((r, idx) => (
                        <tr key={r.id} style={{ borderBottom: `1px solid ${C.amberBorder}`, backgroundColor: idx % 2 === 0 ? '#fff' : '#fffdf8' }}>
                          <td style={{ padding: '0.7rem 0.9rem', color: C.textDark, maxWidth: '200px' }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{r.insumoNombre || '—'}</div>
                            {r.codigoInsumo && (
                              <div style={{ fontSize: '0.72rem', color: C.textLight, fontFamily: 'monospace' }}>{r.codigoInsumo}</div>
                            )}
                          </td>
                          <td style={{ padding: '0.7rem 0.9rem', color: C.textMid, maxWidth: '180px' }}>{nombreCentro(r)}</td>
                          <td style={{ padding: '0.7rem 0.9rem', color: C.textMid, whiteSpace: 'nowrap' }}>
                            <div>{formatFecha(r.fecha)}</div>
                            <div style={{ fontSize: '0.74rem', color: C.textLight }}>{formatHora(r.hora)}</div>
                          </td>
                          <td style={{ padding: '0.7rem 0.9rem', color: C.textMid, whiteSpace: 'nowrap' }}>{r.ambulanciaCodigo || '—'}</td>
                          <td style={{ padding: '0.7rem 0.9rem', color: C.textMid }}>{r.usuarioNombre || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!cargandoP && pendientes.length > 0 && (
                <div style={{ padding: '0.6rem 1rem', borderTop: `1px solid ${C.amberBorder}`, backgroundColor: C.amberLight, fontSize: '0.78rem', color: C.amber, textAlign: 'right', fontWeight: '600' }}>
                  {pendientes.length} insumo{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
