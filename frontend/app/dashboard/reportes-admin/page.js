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
  red:         '#c0392b',
  redLight:    '#fdf0ef',
  redBorder:   '#f0b8b3',
  textDark:    '#1a2e25',
  textMid:     '#4a6a57',
  textLight:   '#7a9e8a',
  cardBg:      '#ffffff',
  cardShadow:  '0 2px 16px rgba(45,134,83,0.08), 0 1px 3px rgba(0,0,0,0.05)',
  navBorder:   '#d5e8dc',
};

function decodificarJWT(token) {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); }
  catch { return null; }
}

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

function formatFecha(f) {
  if (!f) return '—';
  const parts = String(f).split('-');
  if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return f;
}

function formatHora(h) {
  if (!h) return '';
  return String(h).substring(0, 5);
}

function nombreCentro(row) {
  return row.centroOtro || row.centroNombre || '—';
}

const EcgIcon = () => (
  <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <polyline points="1,16 6,16 9,8 12,24 15,12 18,20 21,16 31,16"
      stroke="#2d8653" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

function Btn({ children, onClick, variant = 'primary', size = 'sm', disabled = false, type = 'button', style: extra = {} }) {
  const V = {
    primary:   { bg: C.green,      color: '#fff',     border: C.green       },
    secondary: { bg: C.tealLight,  color: C.teal,     border: C.tealBorder  },
    danger:    { bg: C.redLight,   color: C.red,      border: C.redBorder   },
    amber:     { bg: C.amberLight, color: C.amber,    border: C.amberBorder },
    ghost:     { bg: 'transparent', color: C.textMid, border: C.greenBorder },
  };
  const v = V[variant] || V.primary;
  const pad = size === 'xs' ? '0.25rem 0.5rem' : size === 'sm' ? '0.35rem 0.75rem' : '0.55rem 1rem';
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      backgroundColor: disabled ? '#e0e0e0' : v.bg,
      color:           disabled ? '#999'     : v.color,
      border:          `1px solid ${disabled ? '#ccc' : v.border}`,
      borderRadius:    '8px', padding: pad, fontSize: '0.8rem',
      fontWeight:      '600', cursor: disabled ? 'not-allowed' : 'pointer',
      transition:      'opacity 0.15s', ...extra,
    }}>{children}</button>
  );
}

const inputStyle = {
  padding: '0.55rem 0.75rem', borderRadius: '8px',
  border: `1px solid ${C.greenBorder}`, fontSize: '0.875rem', color: C.textDark,
  outline: 'none', backgroundColor: '#fff',
};

/* ── Funciones de exportación ────────────────────────────────────────────── */
async function exportarPDF(titulo, columnas, filas, nombreArchivo) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape' });
  const hoy = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  doc.setFontSize(14);
  doc.setTextColor(45, 134, 83);
  doc.text('MedicalInventary', 14, 14);
  doc.setTextColor(26, 46, 37);
  doc.setFontSize(11);
  doc.text(titulo, 14, 22);
  doc.setFontSize(9);
  doc.setTextColor(74, 106, 87);
  doc.text(`Generado el: ${hoy}`, 14, 29);

  autoTable(doc, {
    startY: 34,
    head: [columnas],
    body: filas,
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [45, 134, 83], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [232, 243, 237] },
  });

  doc.save(`${nombreArchivo}.pdf`);
}

async function exportarExcel(columnas, filas, nombreHoja, nombreArchivo) {
  const XLSX = await import('xlsx');

  const datos = [columnas, ...filas];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}

/* ── Badge de estado ─────────────────────────────────────────────────────── */
function EstadoBadge({ estado }) {
  const cfg = estado === 'Recuperado'
    ? { bg: C.greenLight, color: C.green, border: C.greenBorder, label: '✓ Recuperado' }
    : { bg: C.amberLight, color: C.amber, border: C.amberBorder, label: '⏳ En centro' };
  return (
    <span style={{
      backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      borderRadius: '6px', padding: '0.2rem 0.55rem',
      fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TAB HISTORIAL
══════════════════════════════════════════════════════════════════════════ */
function TabHistorial({ token, ambulancias, centros }) {
  const [filtros, setFiltros] = useState({
    insumo: '', ambulanciaId: '', centroId: '', fechaDesde: '', fechaHasta: '',
  });
  const [registros,    setRegistros]    = useState([]);
  const [cargando,     setCargando]     = useState(false);
  const [error,        setError]        = useState('');
  const [buscado,      setBuscado]      = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);
  const [exportando,   setExportando]   = useState(false);

  const setF = (k) => (e) => setFiltros(p => ({ ...p, [k]: e.target.value }));

  const buscar = useCallback(async () => {
    setCargando(true); setError(''); setBuscado(true);
    try {
      const params = {};
      if (filtros.insumo.trim())   params.insumo       = filtros.insumo.trim();
      if (filtros.ambulanciaId)    params.ambulanciaId  = filtros.ambulanciaId;
      if (filtros.centroId)        params.centroId      = filtros.centroId;
      if (filtros.fechaDesde)      params.fechaDesde    = filtros.fechaDesde;
      if (filtros.fechaHasta)      params.fechaHasta    = filtros.fechaHasta;

      const { data } = await axios.get(`${API}/api/reportes/admin/historial`, {
        headers: authHeader(token),
        params,
      });
      setRegistros(data);
      setVisibleCount(5);
    } catch {
      setError('No se pudo cargar el historial.');
    } finally {
      setCargando(false);
    }
  }, [filtros, token]);

  const limpiar = () => {
    setFiltros({ insumo: '', ambulanciaId: '', centroId: '', fechaDesde: '', fechaHasta: '' });
    setRegistros([]); setBuscado(false);
  };

  const columnasPDF = ['Código', 'Insumo', 'Centro asistencial', 'Fecha entrega', 'Ambulancia', 'Entregado por', 'Recuperado por', 'Estado'];
  const filasPDF = registros.map(r => [
    r.codigoInsumo || '—',
    r.insumoNombre || '—',
    nombreCentro(r),
    formatFecha(r.fecha) + (r.hora ? ` ${formatHora(r.hora)}` : ''),
    r.ambulanciaCodigo || '—',
    r.usuarioEntrega || '—',
    r.usuarioRecogida || '—',
    r.estadoActual || '—',
  ]);

  const exportarComoExcel = async () => {
    setExportando(true);
    try {
      await exportarExcel(columnasPDF, filasPDF, 'Historial', 'trazabilidad-historial');
    } finally {
      setExportando(false);
    }
  };

  const exportarComoPDF = async () => {
    setExportando(true);
    try {
      await exportarPDF('Historial de Trazabilidad', columnasPDF, filasPDF, 'trazabilidad-historial');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div>
      {/* Filtros */}
      <div style={{ backgroundColor: C.cardBg, borderRadius: '12px', padding: '1.25rem',
        boxShadow: C.cardShadow, marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: C.textLight,
          textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.85rem' }}>
          Filtros
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            value={filtros.insumo}
            onChange={setF('insumo')}
            placeholder="Buscar insumo o código..."
            style={{ flex: '1', minWidth: '200px', ...inputStyle }}
            onKeyDown={e => e.key === 'Enter' && buscar()}
          />
          <select value={filtros.ambulanciaId} onChange={setF('ambulanciaId')}
            style={{ ...inputStyle, cursor: 'pointer', minWidth: '160px' }}>
            <option value="">Todas las ambulancias</option>
            {ambulancias.map(a => (
              <option key={a.id} value={a.id}>{a.codigo}{a.descripcion ? ` · ${a.descripcion}` : ''}</option>
            ))}
          </select>
          <select value={filtros.centroId} onChange={setF('centroId')}
            style={{ ...inputStyle, cursor: 'pointer', minWidth: '180px' }}>
            <option value="">Todos los centros</option>
            {centros.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: C.textMid, whiteSpace: 'nowrap' }}>Desde:</label>
            <input type="date" value={filtros.fechaDesde} onChange={setF('fechaDesde')}
              style={inputStyle} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: C.textMid, whiteSpace: 'nowrap' }}>Hasta:</label>
            <input type="date" value={filtros.fechaHasta} onChange={setF('fechaHasta')}
              style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
          <Btn variant="primary" size="sm" onClick={buscar} disabled={cargando}>
            {cargando ? 'Buscando...' : 'Buscar'}
          </Btn>
          <Btn variant="ghost" size="sm" onClick={limpiar}>Limpiar</Btn>
          {registros.length > 0 && (
            <>
              <Btn variant="ghost" size="sm" onClick={exportarComoPDF} disabled={exportando}>
                PDF
              </Btn>
              <Btn variant="ghost" size="sm" onClick={exportarComoExcel} disabled={exportando}>
                Excel
              </Btn>
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: C.redLight, border: `1px solid ${C.redBorder}`,
          borderRadius: '10px', padding: '0.9rem', marginBottom: '1rem', color: C.red, fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Tabla */}
      <div style={{ backgroundColor: C.cardBg, borderRadius: '14px',
        boxShadow: C.cardShadow, overflow: 'hidden' }}>
        {!buscado ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>
            Aplica filtros y presiona <strong>Buscar</strong> para ver resultados.
          </div>
        ) : cargando ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>Buscando...</div>
        ) : registros.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>
            No se encontraron registros con esos filtros.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: C.greenLight, borderBottom: `2px solid ${C.greenBorder}` }}>
                    {['Código', 'Insumo', 'Centro asistencial', 'Fecha entrega', 'Ambulancia', 'Entregó', 'Recogió', 'Estado'].map(h => (
                      <th key={h} style={{ padding: '0.7rem 0.9rem', textAlign: 'left',
                        fontSize: '0.73rem', fontWeight: '700', color: C.textMid,
                        textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registros.slice(0, visibleCount).map((r, i) => (
                    <tr key={r.id} style={{
                      backgroundColor: i % 2 === 0 ? '#fff' : '#fafcfb',
                      borderBottom: `1px solid ${C.greenBorder}40`,
                    }}>
                      <td style={{ padding: '0.65rem 0.9rem', fontFamily: 'monospace',
                        fontSize: '0.85rem', fontWeight: '700', color: C.green, whiteSpace: 'nowrap' }}>
                        {r.codigoInsumo || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.9rem', fontWeight: '600',
                        color: C.textDark, maxWidth: '160px' }}>
                        {r.insumoNombre || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.9rem', color: C.textMid, maxWidth: '180px' }}>
                        {nombreCentro(r)}
                      </td>
                      <td style={{ padding: '0.65rem 0.9rem', color: C.textMid, whiteSpace: 'nowrap' }}>
                        <div>{formatFecha(r.fecha)}</div>
                        {r.hora && <div style={{ fontSize: '0.75rem', color: C.textLight }}>{formatHora(r.hora)}</div>}
                      </td>
                      <td style={{ padding: '0.65rem 0.9rem', color: C.teal, fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {r.ambulanciaCodigo || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.9rem', color: C.textMid }}>
                        {r.usuarioEntrega || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.9rem', color: C.textMid }}>
                        {r.usuarioRecogida || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.9rem' }}>
                        <EstadoBadge estado={r.estadoActual} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0.65rem 1rem', borderTop: `1px solid ${C.greenBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: '0.5rem', backgroundColor: C.greenLight }}>
              <span style={{ fontSize: '0.78rem', color: C.textLight }}>
                {registros.length} resultado(s)
              </span>
              {visibleCount < registros.length && (
                <Btn variant="ghost" size="sm" onClick={() => setVisibleCount(v => v + 5)}>
                  Ver más ({registros.length - visibleCount} restante{registros.length - visibleCount !== 1 ? 's' : ''})
                </Btn>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TAB PENDIENTES
══════════════════════════════════════════════════════════════════════════ */
function TabPendientes({ token, ambulancias }) {
  const [fechaDesde,   setFechaDesde]   = useState('');
  const [fechaHasta,   setFechaHasta]   = useState('');
  const [ambulanciaId, setAmbulanciaId] = useState('');
  const [registros,    setRegistros]    = useState([]);
  const [cargando,     setCargando]     = useState(false);
  const [error,        setError]        = useState('');
  const [cargadoOnce,  setCargadoOnce]  = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);
  const [exportando,   setExportando]   = useState(false);

  const buscar = useCallback(async () => {
    setCargando(true); setError(''); setCargadoOnce(true);
    try {
      const params = {};
      if (fechaDesde)   params.fechaDesde   = fechaDesde;
      if (fechaHasta)   params.fechaHasta   = fechaHasta;
      const { data } = await axios.get(`${API}/api/reportes/admin/pendientes`, {
        headers: authHeader(token),
        params,
      });
      const filtrados = ambulanciaId
        ? data.filter(r => String(r.ambulanciaId || '') === ambulanciaId ||
            (r.ambulanciaCodigo && ambulancias.find(a => String(a.id) === ambulanciaId)?.codigo === r.ambulanciaCodigo))
        : data;
      setRegistros(filtrados);
      setVisibleCount(5);
    } catch {
      setError('No se pudo cargar los insumos pendientes.');
    } finally {
      setCargando(false);
    }
  }, [fechaDesde, fechaHasta, ambulanciaId, token, ambulancias]);

  useEffect(() => { buscar(); }, []);

  const columnasPDF = ['Código', 'Insumo', 'Centro asistencial', 'Fecha entrega', 'Ambulancia', 'Registrado por'];
  const filasPDF = registros.map(r => [
    r.codigoInsumo || '—',
    r.insumoNombre || '—',
    r.centroOtro || r.centroNombre || '—',
    formatFecha(r.fecha),
    r.ambulanciaCodigo || '—',
    r.usuarioNombre || '—',
  ]);

  const exportarComoPDF = async () => {
    setExportando(true);
    try {
      await exportarPDF('Insumos Pendientes en Centros Asistenciales', columnasPDF, filasPDF, 'insumos-pendientes');
    } finally {
      setExportando(false);
    }
  };

  const exportarComoExcel = async () => {
    setExportando(true);
    try {
      await exportarExcel(columnasPDF, filasPDF, 'Pendientes', 'insumos-pendientes');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div>
      <div style={{ backgroundColor: C.cardBg, borderRadius: '12px', padding: '1.25rem',
        boxShadow: C.cardShadow, marginBottom: '1.25rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: '700', color: C.textLight,
          textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.85rem' }}>
          Filtros
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={ambulanciaId} onChange={e => setAmbulanciaId(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer', minWidth: '180px' }}>
            <option value="">Todas las ambulancias</option>
            {ambulancias.map(a => (
              <option key={a.id} value={a.id}>{a.codigo}{a.descripcion ? ` · ${a.descripcion}` : ''}</option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: C.textMid, whiteSpace: 'nowrap' }}>Desde:</label>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: C.textMid, whiteSpace: 'nowrap' }}>Hasta:</label>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
          <Btn variant="primary" size="sm" onClick={buscar} disabled={cargando}>
            {cargando ? 'Buscando...' : 'Aplicar filtros'}
          </Btn>
          <Btn variant="ghost" size="sm" onClick={() => {
            setFechaDesde(''); setFechaHasta(''); setAmbulanciaId('');
          }}>
            Limpiar filtros
          </Btn>
          {registros.length > 0 && (
            <>
              <Btn variant="ghost" size="sm" onClick={exportarComoPDF} disabled={exportando}>
                PDF
              </Btn>
              <Btn variant="ghost" size="sm" onClick={exportarComoExcel} disabled={exportando}>
                Excel
              </Btn>
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: C.redLight, border: `1px solid ${C.redBorder}`,
          borderRadius: '10px', padding: '0.9rem', marginBottom: '1rem', color: C.red, fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: C.cardBg, borderRadius: '14px',
        boxShadow: C.cardShadow, overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>Cargando...</div>
        ) : registros.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>
            {cargadoOnce
              ? 'No hay insumos pendientes de recuperación con los filtros aplicados.'
              : 'Cargando pendientes...'}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: C.greenLight, borderBottom: `2px solid ${C.greenBorder}` }}>
                    {['Código', 'Insumo', 'Centro asistencial', 'Fecha entrega', 'Ambulancia', 'Registrado por'].map(h => (
                      <th key={h} style={{ padding: '0.7rem 0.9rem', textAlign: 'left',
                        fontSize: '0.73rem', fontWeight: '700', color: C.textMid,
                        textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registros.slice(0, visibleCount).map((r, i) => (
                    <tr key={r.id} style={{
                      backgroundColor: i % 2 === 0 ? '#fff' : '#fffdf8',
                      borderBottom: `1px solid ${C.amberBorder}40`,
                    }}>
                      <td style={{ padding: '0.65rem 0.9rem', fontFamily: 'monospace',
                        fontSize: '0.85rem', fontWeight: '700', color: C.green, whiteSpace: 'nowrap' }}>
                        {r.codigoInsumo || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.9rem', fontWeight: '600',
                        color: C.textDark, maxWidth: '160px' }}>
                        {r.insumoNombre || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.9rem', color: C.textMid, maxWidth: '200px' }}>
                        {r.centroOtro || r.centroNombre || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.9rem', color: C.textMid, whiteSpace: 'nowrap' }}>
                        {formatFecha(r.fecha)}
                      </td>
                      <td style={{ padding: '0.65rem 0.9rem', color: C.teal, fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {r.ambulanciaCodigo || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.9rem', color: C.textMid }}>
                        {r.usuarioNombre || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0.65rem 1rem', borderTop: `1px solid ${C.amberBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: '0.5rem', backgroundColor: C.amberLight }}>
              <span style={{ fontSize: '0.78rem', color: C.amber, fontWeight: '600' }}>
                {registros.length} insumo(s) pendiente(s) de recuperación
              </span>
              {visibleCount < registros.length && (
                <Btn variant="ghost" size="sm" onClick={() => setVisibleCount(v => v + 5)}>
                  Ver más ({registros.length - visibleCount} restante{registros.length - visibleCount !== 1 ? 's' : ''})
                </Btn>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Página principal ────────────────────────────────────────────────────── */
export default function ReportesAdminPage() {
  const router = useRouter();
  const [usuario,     setUsuario]     = useState(null);
  const [token,       setToken]       = useState(null);
  const [ambulancias, setAmbulancias] = useState([]);
  const [centros,     setCentros]     = useState([]);
  const [tab,         setTab]         = useState('historial');

  useEffect(() => {
    const tkn = Cookies.get('token');
    if (!tkn) { router.push('/login'); return; }
    const decoded = decodificarJWT(tkn);
    if (!decoded || (decoded.exp && Date.now() / 1000 > decoded.exp)) {
      Cookies.remove('token'); Cookies.remove('usuario'); router.push('/login'); return;
    }
    if (decoded.rol !== 'admin') { router.push('/dashboard'); return; }
    setToken(tkn);
    try {
      const u = Cookies.get('usuario');
      setUsuario(u ? JSON.parse(u) : { numero_ambulancia: decoded.numero_ambulancia, rol: decoded.rol });
    } catch {
      setUsuario({ numero_ambulancia: decoded.numero_ambulancia, rol: decoded.rol });
    }
  }, [router]);

  useEffect(() => {
    if (!token) return;
    const h = authHeader(token);
    Promise.all([
      axios.get(`${API}/api/ambulancias`, { headers: h }),
      axios.get(`${API}/api/centros`,     { headers: h }),
    ]).then(([ambRes, centRes]) => {
      setAmbulancias(ambRes.data || []);
      setCentros((centRes.data || []).filter(c => !c.esOtro));
    }).catch(() => {});
  }, [token]);

  const cerrarSesion = () => {
    Cookies.remove('token'); Cookies.remove('usuario'); router.push('/login');
  };

  if (!usuario) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: C.bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.textMid }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg }}>
      {/* Navbar */}
      <header style={{
        backgroundColor: C.cardBg, borderBottom: `1px solid ${C.navBorder}`,
        padding: '0.9rem 2rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 4px rgba(45,134,83,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/dashboard" style={{ color: C.textMid, textDecoration: 'none', fontSize: '0.875rem' }}>
            ← Dashboard
          </Link>
          <span style={{ color: C.greenBorder }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', backgroundColor: C.greenLight,
              border: `1px solid ${C.greenBorder}`, borderRadius: '8px' }}>
              <EcgIcon />
            </div>
            <span style={{ fontWeight: '700', fontSize: '1rem', color: C.textDark }}>
              Medical<span style={{ color: C.green }}>Inventary</span>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {usuario && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.85rem', color: C.textDark, fontWeight: '600', lineHeight: '1.2' }}>
                {usuario.nombre || usuario.numero_ambulancia}
              </p>
              <p style={{ fontSize: '0.72rem', color: C.green, textTransform: 'capitalize', fontWeight: '500' }}>
                {usuario.rol}
              </p>
            </div>
          )}
          <button onClick={cerrarSesion} style={{
            backgroundColor: C.redLight, border: `1px solid ${C.redBorder}`,
            borderRadius: '8px', padding: '0.45rem 0.9rem', color: C.red,
            fontSize: '0.82rem', cursor: 'pointer', fontWeight: '500',
          }}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main style={{ padding: '2rem', maxWidth: '1300px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700', color: C.textDark, marginBottom: '0.25rem' }}>
            Trazabilidad
          </h1>
          <p style={{ color: C.textMid, fontSize: '0.875rem' }}>
            Historial de entregas, recuperaciones e insumos pendientes por ambulancia o centro.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem',
          backgroundColor: C.cardBg, borderRadius: '10px', padding: '4px',
          boxShadow: C.cardShadow, width: 'fit-content' }}>
          {[
            { id: 'historial',  label: 'Historial completo' },
            { id: 'pendientes', label: 'Pendientes de recuperación' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '0.5rem 1.25rem', borderRadius: '7px', fontSize: '0.875rem',
              fontWeight: '600', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              backgroundColor: tab === t.id ? C.green : 'transparent',
              color:           tab === t.id ? '#fff'  : C.textMid,
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'historial' && token && (
          <TabHistorial token={token} ambulancias={ambulancias} centros={centros} />
        )}
        {tab === 'pendientes' && token && (
          <TabPendientes token={token} ambulancias={ambulancias} />
        )}
      </main>
    </div>
  );
}
