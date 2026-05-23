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
  const pad = size === 'xs' ? '0.25rem 0.5rem' : size === 'sm' ? '0.35rem 0.75rem' : '0.6rem 1.2rem';
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

function Modal({ children, onClose, width = '520px' }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(26,46,37,0.45)',
      backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        backgroundColor: C.cardBg, borderRadius: '16px', padding: '2rem',
        width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
      }}>{children}</div>
    </div>
  );
}

function Campo({ label, children, error }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600',
        color: C.textMid, marginBottom: '0.35rem' }}>{label}</label>
      {children}
      {error && <p style={{ color: C.red, fontSize: '0.75rem', marginTop: '0.25rem' }}>{error}</p>}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px',
  border: `1px solid ${C.greenBorder}`, fontSize: '0.875rem', color: C.textDark,
  outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff',
};

/* ── Modal Crear / Editar Centro ─────────────────────────────────────────── */
function ModalCentro({ centro, token, onClose, onSaved }) {
  const esNuevo = !centro;
  const [form, setForm] = useState({
    nombre:    centro?.nombre    || '',
    direccion: centro?.direccion || '',
    telefono:  centro?.telefono  || '',
    correo:    centro?.correo    || '',
  });
  const [errores,  setErrores]  = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error,    setError]    = useState('');

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const guardar = async (ev) => {
    ev.preventDefault();
    const e = {};
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio';
    if (Object.keys(e).length > 0) { setErrores(e); return; }
    setEnviando(true); setError('');
    try {
      if (esNuevo) {
        await axios.post(`${API}/api/centros`, form, { headers: authHeader(token) });
      } else {
        await axios.put(`${API}/api/centros/${centro.id}`, form, { headers: authHeader(token) });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar el centro');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: C.textDark, marginBottom: '1.5rem' }}>
        {esNuevo ? 'Nuevo centro asistencial' : `Editar: ${centro.nombre}`}
      </h2>

      {error && (
        <div style={{ backgroundColor: C.redLight, border: `1px solid ${C.redBorder}`,
          borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem',
          color: C.red, fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={guardar}>
        <Campo label="Nombre *" error={errores.nombre}>
          <input value={form.nombre} onChange={set('nombre')}
            placeholder="Ej: Hospital General de Medellín" style={inputStyle} />
        </Campo>
        <Campo label="Dirección">
          <input value={form.direccion} onChange={set('direccion')}
            placeholder="Ej: Calle 24 # 29-35, El Centro" style={inputStyle} />
        </Campo>
        <Campo label="Teléfono">
          <input value={form.telefono} onChange={set('telefono')}
            placeholder="Ej: 604 444 5555" style={inputStyle} />
        </Campo>
        <Campo label="Correo electrónico">
          <input type="email" value={form.correo} onChange={set('correo')}
            placeholder="contacto@hospital.com" style={inputStyle} />
        </Campo>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" type="submit" disabled={enviando}>
            {enviando ? 'Guardando...' : 'Guardar'}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

/* ── Modal Ver Insumos del Centro ────────────────────────────────────────── */
function ModalInsumos({ centro, token, onClose }) {
  const [movimientos,  setMovimientos]  = useState([]);
  const [cargando,     setCargando]     = useState(true);
  const [busqueda,     setBusqueda]     = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    setCargando(true);
    axios.get(`${API}/api/reportes/admin/historial`, {
      headers: authHeader(token),
      params: { centroId: centro.id },
    })
      .then(({ data }) => setMovimientos(data))
      .catch(() => setMovimientos([]))
      .finally(() => setCargando(false));
  }, [centro.id, token]);

  const filtrados = movimientos.filter(m => {
    const q = busqueda.toLowerCase();
    const coincideBusqueda = !q ||
      (m.insumoNombre || '').toLowerCase().includes(q) ||
      (m.codigoInsumo || '').toLowerCase().includes(q);
    const coincideEstado = !filtroEstado || m.estadoActual === filtroEstado;
    return coincideBusqueda && coincideEstado;
  });

  useEffect(() => { setVisibleCount(5); }, [busqueda, filtroEstado]);

  return (
    <Modal onClose={onClose} width="900px">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: C.textDark, marginBottom: '0.2rem' }}>
            Insumos — {centro.nombre}
          </h2>
          <p style={{ fontSize: '0.82rem', color: C.textLight }}>
            {movimientos.length} registro(s) de entrega encontrado(s)
          </p>
        </div>
        <Btn variant="ghost" onClick={onClose}>✕ Cerrar</Btn>
      </div>

      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o código..."
          style={{ flex: 1, minWidth: '200px', ...inputStyle }} />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
          <option value="">Todos los estados</option>
          <option value="En centro asistencial">En centro asistencial</option>
          <option value="Recuperado">Recuperado</option>
        </select>
        {(busqueda || filtroEstado) && (
          <Btn variant="ghost" size="sm" onClick={() => { setBusqueda(''); setFiltroEstado(''); }}>✕ Limpiar</Btn>
        )}
      </div>

      {cargando ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>
          Cargando insumos...
        </div>
      ) : filtrados.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>
          {movimientos.length === 0
            ? 'No hay insumos registrados en este centro.'
            : 'No se encontraron resultados con los filtros aplicados.'}
        </div>
      ) : (
        <div style={{ backgroundColor: C.cardBg, border: `1px solid ${C.amberBorder}`,
          borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: C.greenLight, borderBottom: `2px solid ${C.greenBorder}` }}>
                  {['Insumo', 'Código', 'Estado actual', 'Fecha entrega', 'Ambulancia', 'Registrado por'].map(h => (
                    <th key={h} style={{ padding: '0.65rem 0.9rem', textAlign: 'left',
                      fontSize: '0.73rem', fontWeight: '700', color: C.textMid,
                      textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, visibleCount).map((m, i) => (
                  <tr key={m.id} style={{
                    backgroundColor: i % 2 === 0 ? '#fff' : '#fffdf8',
                    borderBottom: `1px solid ${C.amberBorder}40`,
                  }}>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: '600',
                      color: C.textDark, maxWidth: '180px' }}>
                      {m.insumoNombre || '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontFamily: 'monospace',
                      fontSize: '0.85rem', fontWeight: '700', color: C.green, whiteSpace: 'nowrap' }}>
                      {m.codigoInsumo || '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem' }}>
                      <span style={{
                        backgroundColor: m.estadoActual === 'Recuperado' ? C.greenLight : C.amberLight,
                        color:           m.estadoActual === 'Recuperado' ? C.green       : C.amber,
                        border:          `1px solid ${m.estadoActual === 'Recuperado' ? C.greenBorder : C.amberBorder}`,
                        borderRadius:    '6px', padding: '0.2rem 0.55rem',
                        fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap',
                      }}>
                        {m.estadoActual === 'Recuperado' ? '✓ Recuperado' : '⏳ En centro'}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', color: C.textMid, whiteSpace: 'nowrap' }}>
                      {formatFecha(m.fecha)}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', color: C.teal, fontWeight: '600' }}>
                      {m.ambulanciaCodigo || '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', color: C.textMid }}>
                      {m.usuarioEntrega || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleCount < filtrados.length && (
            <div style={{ padding: '0.85rem', textAlign: 'center',
              borderTop: `1px solid ${C.amberBorder}` }}>
              <Btn variant="ghost" size="sm" onClick={() => setVisibleCount(v => v + 5)}>
                Ver más ({filtrados.length - visibleCount} restante{filtrados.length - visibleCount !== 1 ? 's' : ''})
              </Btn>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ── Página principal ────────────────────────────────────────────────────── */
export default function CentrosPage() {
  const router = useRouter();
  const [usuario,      setUsuario]      = useState(null);
  const [token,        setToken]        = useState(null);
  const [centros,      setCentros]      = useState([]);
  const [cargando,     setCargando]     = useState(true);
  const [errorGlobal,  setErrorGlobal]  = useState('');
  const [busqueda,     setBusqueda]     = useState('');
  const [visibleCount, setVisibleCount] = useState(5);
  const [modalCentro,  setModalCentro]  = useState(null);
  const [modalInsumos, setModalInsumos] = useState(null);

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

  const cargarCentros = useCallback(async (tkn) => {
    if (!tkn) return;
    setCargando(true); setErrorGlobal('');
    try {
      const { data } = await axios.get(`${API}/api/centros`, { headers: authHeader(tkn) });
      setCentros(data);
      setVisibleCount(5);
    } catch {
      setErrorGlobal('No se pudo cargar la lista de centros asistenciales.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { if (token) cargarCentros(token); }, [token, cargarCentros]);
  useEffect(() => { setVisibleCount(5); }, [busqueda]);

  const toggleActivo = async (centro) => {
    const accion = centro.activo ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} el centro "${centro.nombre}"?`)) return;
    try {
      await axios.patch(`${API}/api/centros/${centro.id}/toggle`, {}, { headers: authHeader(token) });
      cargarCentros(token);
    } catch (err) {
      alert(err.response?.data?.message || `Error al ${accion} el centro`);
    }
  };

  const eliminar = async (centro) => {
    if (!confirm(`¿Eliminar permanentemente "${centro.nombre}"?\nEsta acción no se puede deshacer.`)) return;
    try {
      await axios.delete(`${API}/api/centros/${centro.id}`, { headers: authHeader(token) });
      cargarCentros(token);
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar el centro');
    }
  };

  const cerrarSesion = () => {
    Cookies.remove('token'); Cookies.remove('usuario'); router.push('/login');
  };

  const centrosFiltrados = centros.filter(c => {
    if (c.esOtro) return false;
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (
      c.nombre?.toLowerCase().includes(q) ||
      c.municipio?.toLowerCase().includes(q) ||
      c.direccion?.toLowerCase().includes(q)
    );
  });

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
              width: '32px', height: '32px', backgroundColor: C.amberLight,
              border: `1px solid ${C.amberBorder}`, borderRadius: '8px', fontSize: '1rem' }}>
              🏥
            </div>
            <span style={{ fontWeight: '700', fontSize: '1rem', color: C.textDark }}>
              Centros Asistenciales
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

      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '700', color: C.textDark, marginBottom: '0.2rem' }}>
              Centros Asistenciales
            </h1>
            <p style={{ color: C.textMid, fontSize: '0.875rem' }}>
              {centrosFiltrados.length} de {centros.filter(c => !c.esOtro).length} centro(s) registrado(s)
            </p>
          </div>
          <Btn variant="primary" size="md" onClick={() => setModalCentro({})}>
            + Nuevo centro asistencial
          </Btn>
        </div>

        {/* Buscador */}
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '1.25rem',
          backgroundColor: C.cardBg, borderRadius: '12px', padding: '1rem', boxShadow: C.cardShadow }}>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, municipio o dirección..."
            style={{ flex: 1, minWidth: '220px', padding: '0.55rem 0.9rem', borderRadius: '8px',
              border: `1px solid ${C.greenBorder}`, fontSize: '0.875rem', color: C.textDark,
              outline: 'none', backgroundColor: '#fff' }}
          />
          {busqueda && (
            <Btn variant="ghost" size="sm" onClick={() => setBusqueda('')}>✕ Limpiar</Btn>
          )}
        </div>

        {errorGlobal && (
          <div style={{ backgroundColor: C.redLight, border: `1px solid ${C.redBorder}`,
            borderRadius: '10px', padding: '0.9rem 1.2rem', marginBottom: '1.25rem',
            color: C.red, fontSize: '0.875rem' }}>
            {errorGlobal}
          </div>
        )}

        {/* Tabla */}
        <div style={{ backgroundColor: C.cardBg, borderRadius: '14px',
          boxShadow: C.cardShadow, overflow: 'hidden' }}>
          {cargando ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>
              Cargando centros asistenciales...
            </div>
          ) : centrosFiltrados.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>
              {busqueda
                ? 'No se encontraron centros con esa búsqueda.'
                : 'No hay centros asistenciales registrados.'}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: C.greenLight, borderBottom: `2px solid ${C.greenBorder}` }}>
                      {['Nombre', 'Dirección', 'Contacto', 'F. Registro', 'Estado', 'Acciones'].map(h => (
                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left',
                          fontSize: '0.73rem', fontWeight: '700', color: C.textMid,
                          textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {centrosFiltrados.slice(0, visibleCount).map((c, i) => (
                      <tr
                        key={c.id}
                        style={{
                          backgroundColor: i % 2 === 0 ? '#fff' : '#fffdf8',
                          borderBottom: `1px solid ${C.amberBorder}40`,
                          transition: 'background-color 0.12s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = C.amberLight}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#fff' : '#fffdf8'}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontWeight: '600',
                          color: C.textDark, maxWidth: '200px' }}>
                          {c.nombre}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: C.textMid,
                          fontSize: '0.85rem', maxWidth: '180px' }}>
                          {c.direccion || '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: C.textMid, fontSize: '0.85rem' }}>
                          <div>{c.telefono || '—'}</div>
                          {c.correo && (
                            <div style={{ fontSize: '0.78rem', color: C.textLight }}>{c.correo}</div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: C.textLight,
                          fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {formatFecha(c.fechaRegistro) || '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{
                            backgroundColor: c.activo ? C.greenLight : C.redLight,
                            color:           c.activo ? C.green      : C.red,
                            border:          `1px solid ${c.activo ? C.greenBorder : C.redBorder}`,
                            borderRadius:    '6px', padding: '0.2rem 0.55rem',
                            fontSize: '0.74rem', fontWeight: '600',
                          }}>
                            {c.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <Btn variant="ghost" size="xs" onClick={() => setModalInsumos(c)}>
                              Ver insumos
                            </Btn>
                            <Btn variant="secondary" size="xs" onClick={() => setModalCentro(c)}>
                              Editar
                            </Btn>
                            <Btn
                              variant={c.activo ? 'amber' : 'primary'}
                              size="xs"
                              onClick={() => toggleActivo(c)}
                            >
                              {c.activo ? 'Desactivar' : 'Activar'}
                            </Btn>
                            <Btn variant="danger" size="xs" onClick={() => eliminar(c)}>
                              Eliminar
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {visibleCount < centrosFiltrados.length && (
                <div style={{ padding: '1rem 1.5rem', textAlign: 'center',
                  borderTop: `1px solid ${C.amberBorder}` }}>
                  <Btn variant="ghost" size="sm" onClick={() => setVisibleCount(v => v + 5)}>
                    Ver más ({centrosFiltrados.length - visibleCount} restante{centrosFiltrados.length - visibleCount !== 1 ? 's' : ''})
                  </Btn>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modales */}
      {modalCentro !== null && (
        <ModalCentro
          centro={modalCentro.id ? modalCentro : null}
          token={token}
          onClose={() => setModalCentro(null)}
          onSaved={() => { setModalCentro(null); cargarCentros(token); }}
        />
      )}
      {modalInsumos && (
        <ModalInsumos
          centro={modalInsumos}
          token={token}
          onClose={() => setModalInsumos(null)}
        />
      )}
    </div>
  );
}
