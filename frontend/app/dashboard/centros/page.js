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
  cardShadow:  '0 2px 16px rgba(45,134,83,0.08), 0 1px 3px rgba(0,0,0,0.05)',
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

/* ── Vista de insumos por centro (F4) ─────────────────────────── */
function VistaInsumos({ centroId, centroNombre, onVolver, token }) {
  const [insumos,       setInsumos]       = useState([]);
  const [cargando,      setCargando]      = useState(true);
  const [error,         setError]         = useState('');
  const [busqueda,      setBusqueda]      = useState('');
  const [filtroEstado,  setFiltroEstado]  = useState('');

  useEffect(() => {
    setCargando(true);
    setError('');
    axios.get(`${API}/api/reportes/admin/historial`, {
      params:  { centroId },
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(({ data }) => setInsumos(data))
      .catch(() => setError('No se pudo cargar los insumos de este centro.'))
      .finally(() => setCargando(false));
  }, [centroId, token]);

  const filtrados = insumos.filter(r => {
    const texto = `${r.insumoNombre || ''} ${r.codigoInsumo || ''}`.toLowerCase();
    if (busqueda && !texto.includes(busqueda.toLowerCase())) return false;
    if (filtroEstado && r.estadoActual !== filtroEstado) return false;
    return true;
  });

  return (
    <div>
      {/* Cabecera de la vista */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={onVolver}
          style={{ backgroundColor: C.greenLight, color: C.textMid, border: `1px solid ${C.greenBorder}`, borderRadius: '8px', padding: '0.45rem 0.85rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
        >
          ← Volver
        </button>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: C.textDark, margin: 0 }}>
            Insumos — {centroNombre}
          </h2>
          <p style={{ color: C.textMid, fontSize: '0.82rem', margin: 0 }}>Historial de insumos entregados a este centro</p>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px', minWidth: '180px' }}>
          <label style={labelStyle}>Buscar</label>
          <input
            type="text"
            placeholder="Nombre o código de insumo..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: '0 1 180px' }}>
          <label style={labelStyle}>Estado</label>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={selectStyle}>
            <option value="">Todos</option>
            <option value="En centro asistencial">En centro</option>
            <option value="Recuperado">Recuperado</option>
          </select>
        </div>
        {(busqueda || filtroEstado) && (
          <button
            onClick={() => { setBusqueda(''); setFiltroEstado(''); }}
            style={{ alignSelf: 'flex-end', backgroundColor: C.greenLight, color: C.textMid, border: `1px solid ${C.greenBorder}`, borderRadius: '8px', padding: '0.6rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '500' }}
          >
            Limpiar
          </button>
        )}
      </div>

      {error && (
        <div style={{ backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '10px', padding: '0.9rem 1.25rem', marginBottom: '1.25rem', color: C.errorColor, fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div style={{ backgroundColor: C.cardBg, border: `1px solid ${C.greenBorder}`, borderRadius: '12px', boxShadow: C.cardShadow, overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight, fontSize: '0.9rem' }}>Cargando insumos...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight, fontSize: '0.9rem' }}>
            {insumos.length === 0 ? 'No hay insumos registrados para este centro.' : 'No hay resultados para la búsqueda aplicada.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.835rem' }}>
              <thead>
                <tr style={{ backgroundColor: C.greenLight, borderBottom: `2px solid ${C.greenBorder}` }}>
                  {['Insumo', 'Fecha y hora', 'Ambulancia', 'Estado'].map(col => (
                    <th key={col} style={{ padding: '0.7rem 0.9rem', textAlign: 'left', fontWeight: '600', color: C.textDark, whiteSpace: 'nowrap', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r, idx) => (
                  <tr key={r.id} style={{ borderBottom: idx < filtrados.length - 1 ? `1px solid ${C.greenBorder}40` : 'none', backgroundColor: idx % 2 === 0 ? '#fff' : '#fafcfb' }}>
                    <td style={{ padding: '0.7rem 0.9rem', color: C.textDark }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{r.insumoNombre || '—'}</div>
                      {r.codigoInsumo && (
                        <div style={{ fontSize: '0.72rem', color: C.textLight, fontFamily: 'monospace' }}>{r.codigoInsumo}</div>
                      )}
                    </td>
                    <td style={{ padding: '0.7rem 0.9rem', color: C.textMid, whiteSpace: 'nowrap' }}>
                      <div>{formatFecha(r.fecha)}</div>
                      <div style={{ fontSize: '0.74rem', color: C.textLight }}>{formatHora(r.hora)}</div>
                    </td>
                    <td style={{ padding: '0.7rem 0.9rem', color: C.textMid, whiteSpace: 'nowrap' }}>{r.ambulanciaCodigo || '—'}</td>
                    <td style={{ padding: '0.7rem 0.9rem' }}>
                      <span style={{
                        display:         'inline-block',
                        padding:         '0.2rem 0.55rem',
                        borderRadius:    '6px',
                        fontSize:        '0.76rem',
                        fontWeight:      '600',
                        backgroundColor: r.estadoActual === 'Recuperado' ? C.greenLight  : C.amberLight,
                        color:           r.estadoActual === 'Recuperado' ? C.green        : C.amber,
                        border:          `1px solid ${r.estadoActual === 'Recuperado' ? C.greenBorder : C.amberBorder}`,
                        whiteSpace:      'nowrap',
                      }}>
                        {r.estadoActual === 'Recuperado' ? '✓ Recuperado' : '⏳ En centro'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!cargando && filtrados.length > 0 && (
          <div style={{ padding: '0.6rem 1rem', borderTop: `1px solid ${C.greenBorder}`, backgroundColor: C.greenLight, fontSize: '0.78rem', color: C.textLight, textAlign: 'right' }}>
            {filtrados.length} de {insumos.length} registro{insumos.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Modal de centro ──────────────────────────────────────────── */
function ModalCentro({ centro, onClose, onGuardar, guardando, errorModal }) {
  const esEdicion = Boolean(centro?.id);
  const [form, setForm] = useState({
    nombre:    centro?.nombre    || '',
    municipio: centro?.municipio || 'Valle de Aburrá',
    direccion: centro?.direccion || '',
    telefono:  centro?.telefono  || '',
    correo:    centro?.correo    || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onGuardar({ ...form, id: centro?.id });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ backgroundColor: C.cardBg, borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: C.textDark, margin: 0 }}>
            {esEdicion ? 'Editar centro' : 'Nuevo centro asistencial'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: C.textLight, lineHeight: 1 }}>×</button>
        </div>

        {errorModal && (
          <div style={{ backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', color: C.errorColor, fontSize: '0.85rem' }}>
            {errorModal}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Nombre <span style={{ color: C.errorColor }}>*</span></label>
            <input
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              required
              maxLength={200}
              placeholder="Nombre del centro asistencial"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Municipio</label>
            <input
              name="municipio"
              value={form.municipio}
              onChange={handleChange}
              maxLength={100}
              placeholder="Valle de Aburrá"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Dirección</label>
            <input
              name="direccion"
              value={form.direccion}
              onChange={handleChange}
              maxLength={300}
              placeholder="Calle / carrera / número..."
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>Teléfono</label>
              <input
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                maxLength={30}
                placeholder="Ej. 604 123 4567"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Correo</label>
              <input
                name="correo"
                type="email"
                value={form.correo}
                onChange={handleChange}
                maxLength={150}
                placeholder="ejemplo@centro.com"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ backgroundColor: C.greenLight, color: C.textMid, border: `1px solid ${C.greenBorder}`, borderRadius: '8px', padding: '0.6rem 1.1rem', cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              style={{ backgroundColor: guardando ? C.greenMid : C.green, color: '#fff', border: 'none', borderRadius: '8px', padding: '0.6rem 1.4rem', cursor: guardando ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.875rem', opacity: guardando ? 0.8 : 1 }}
            >
              {guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear centro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Página principal ─────────────────────────────────────────── */
export default function CentrosPage() {
  const router = useRouter();
  const [usuario,        setUsuario]        = useState(null);

  const [centros,        setCentros]        = useState([]);
  const [cargando,       setCargando]       = useState(true);
  const [error,          setError]          = useState('');
  const [busqueda,       setBusqueda]       = useState('');
  const [visibleCount,   setVisibleCount]   = useState(5);

  const [modalAbierto,   setModalAbierto]   = useState(false);
  const [centroEditando, setCentroEditando] = useState(null);
  const [errorModal,     setErrorModal]     = useState('');
  const [guardando,      setGuardando]      = useState(false);

  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [errorEliminar,   setErrorEliminar]   = useState('');
  const [eliminando,      setEliminando]      = useState(false);

  const [vistaInsumos, setVistaInsumos] = useState(null);

  /* ── Auth ── */
  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) { router.push('/login'); return; }
    const decoded = decodificarJWT(token);
    if (!decoded || (decoded.exp && Date.now() / 1000 > decoded.exp)) {
      Cookies.remove('token'); Cookies.remove('usuario');
      router.push('/login'); return;
    }
    if (decoded.rol !== 'admin') { router.push('/dashboard'); return; }
    try {
      const u = JSON.parse(Cookies.get('usuario') || '{}');
      setUsuario(u.id ? u : { nombre: decoded.nombre, rol: decoded.rol });
    } catch {
      setUsuario({ nombre: decoded.nombre, rol: decoded.rol });
    }
  }, [router]);

  const cargarCentros = useCallback((q = '') => {
    const token = Cookies.get('token');
    if (!token) return;
    setCargando(true);
    setError('');
    const params = q.trim() ? { q: q.trim() } : {};
    axios.get(`${API}/api/centros`, { params, headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => { setCentros(data); setVisibleCount(5); })
      .catch(() => setError('No se pudo cargar los centros. Intente nuevamente.'))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (usuario) cargarCentros();
  }, [usuario, cargarCentros]);

  /* Búsqueda con debounce sencillo */
  useEffect(() => {
    const t = setTimeout(() => { if (usuario) cargarCentros(busqueda); }, 350);
    return () => clearTimeout(t);
  }, [busqueda, usuario, cargarCentros]);

  const abrirNuevo = () => { setCentroEditando(null); setErrorModal(''); setModalAbierto(true); };
  const abrirEditar = (c) => { setCentroEditando(c); setErrorModal(''); setModalAbierto(true); };
  const cerrarModal = () => { setModalAbierto(false); setCentroEditando(null); setErrorModal(''); };

  const guardarCentro = async (data) => {
    const token = Cookies.get('token');
    if (!token) return;
    setGuardando(true);
    setErrorModal('');
    try {
      if (data.id) {
        await axios.put(`${API}/api/centros/${data.id}`, data, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${API}/api/centros`, data, { headers: { Authorization: `Bearer ${token}` } });
      }
      cerrarModal();
      cargarCentros(busqueda);
    } catch (err) {
      setErrorModal(err.response?.data?.message || 'Error al guardar el centro.');
    } finally {
      setGuardando(false);
    }
  };

  const toggleActivo = async (centro) => {
    const token = Cookies.get('token');
    if (!token) return;
    try {
      await axios.patch(`${API}/api/centros/${centro.id}/toggle`, {}, { headers: { Authorization: `Bearer ${token}` } });
      cargarCentros(busqueda);
    } catch {
      setError('No se pudo cambiar el estado del centro.');
    }
  };

  const eliminar = async () => {
    if (!confirmEliminar) return;
    const token = Cookies.get('token');
    if (!token) return;
    setEliminando(true);
    setErrorEliminar('');
    try {
      await axios.delete(`${API}/api/centros/${confirmEliminar.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setConfirmEliminar(null);
      cargarCentros(busqueda);
    } catch (err) {
      setErrorEliminar(err.response?.data?.message || 'Error al eliminar el centro.');
    } finally {
      setEliminando(false);
    }
  };

  if (!usuario) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.textMid }}>Cargando...</p>
      </div>
    );
  }

  const token = Cookies.get('token');

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

      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>

        {/* Vista de insumos por centro (F4) */}
        {vistaInsumos ? (
          <VistaInsumos
            centroId={vistaInsumos.centroId}
            centroNombre={vistaInsumos.centroNombre}
            onVolver={() => setVistaInsumos(null)}
            token={token}
          />
        ) : (
          <>
            {/* Encabezado */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
              <div>
                <h1 style={{ fontSize: '1.35rem', fontWeight: '700', color: C.textDark, marginBottom: '0.25rem' }}>Gestión de Centros Asistenciales</h1>
                <p style={{ color: C.textMid, fontSize: '0.875rem', margin: 0 }}>Registra y administra los centros asistenciales del sistema.</p>
              </div>
              <button
                onClick={abrirNuevo}
                style={{ backgroundColor: C.green, color: '#fff', border: 'none', borderRadius: '10px', padding: '0.65rem 1.3rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
              >
                + Nuevo centro
              </button>
            </div>

            {/* Barra de búsqueda */}
            <div style={{ marginBottom: '1.25rem' }}>
              <input
                type="text"
                placeholder="Buscar por nombre o municipio..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ ...inputStyle, maxWidth: '380px' }}
              />
            </div>

            {error && (
              <div style={{ backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '10px', padding: '0.9rem 1.25rem', marginBottom: '1.25rem', color: C.errorColor, fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            {/* Tabla */}
            <div style={{ backgroundColor: C.cardBg, border: `1px solid ${C.greenBorder}`, borderRadius: '14px', boxShadow: C.cardShadow, overflow: 'hidden' }}>
              {cargando ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight, fontSize: '0.9rem' }}>Cargando centros...</div>
              ) : centros.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <p style={{ color: C.textMid, fontWeight: '600', fontSize: '0.95rem', marginBottom: '0.4rem' }}>
                    {busqueda ? 'Sin resultados' : 'Sin centros registrados'}
                  </p>
                  <p style={{ color: C.textLight, fontSize: '0.875rem' }}>
                    {busqueda ? 'Prueba con otro término de búsqueda.' : 'Crea el primer centro asistencial.'}
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.835rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: C.greenLight, borderBottom: `2px solid ${C.greenBorder}` }}>
                          {['Nombre', 'Municipio', 'Dirección', 'Contacto', 'Fecha registro', 'Estado', 'Acciones'].map(col => (
                            <th key={col} style={{ padding: '0.7rem 0.9rem', textAlign: 'left', fontWeight: '600', color: C.textDark, whiteSpace: 'nowrap', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {centros.slice(0, visibleCount).map((c, idx) => (
                          <tr key={c.id} style={{ borderBottom: idx < Math.min(visibleCount, centros.length) - 1 ? `1px solid ${C.greenBorder}40` : 'none', backgroundColor: idx % 2 === 0 ? '#fff' : '#fafcfb' }}>
                            <td style={{ padding: '0.75rem 0.9rem', color: C.textDark, fontWeight: '600', maxWidth: '200px' }}>{c.nombre}</td>
                            <td style={{ padding: '0.75rem 0.9rem', color: C.textMid }}>{c.municipio || '—'}</td>
                            <td style={{ padding: '0.75rem 0.9rem', color: C.textMid, maxWidth: '180px' }}>{c.direccion || '—'}</td>
                            <td style={{ padding: '0.75rem 0.9rem', color: C.textMid, maxWidth: '180px' }}>
                              {c.telefono && <div style={{ fontSize: '0.82rem' }}>{c.telefono}</div>}
                              {c.correo   && <div style={{ fontSize: '0.78rem', color: C.textLight }}>{c.correo}</div>}
                              {!c.telefono && !c.correo && '—'}
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem', color: C.textMid, whiteSpace: 'nowrap' }}>{formatFecha(c.fechaRegistro)}</td>
                            <td style={{ padding: '0.75rem 0.9rem' }}>
                              <span style={{
                                display:         'inline-block',
                                padding:         '0.2rem 0.55rem',
                                borderRadius:    '6px',
                                fontSize:        '0.76rem',
                                fontWeight:      '600',
                                backgroundColor: c.activo ? C.greenLight  : '#f3f4f6',
                                color:           c.activo ? C.green        : '#6b7280',
                                border:          `1px solid ${c.activo ? C.greenBorder : '#d1d5db'}`,
                                whiteSpace:      'nowrap',
                              }}>
                                {c.activo ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.9rem' }}>
                              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'nowrap' }}>
                                <button
                                  onClick={() => setVistaInsumos({ centroId: c.id, centroNombre: c.nombre })}
                                  title="Ver insumos"
                                  style={{ backgroundColor: C.tealLight, color: C.teal, border: `1px solid ${C.tealBorder}`, borderRadius: '7px', padding: '0.35rem 0.65rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', whiteSpace: 'nowrap' }}
                                >
                                  📦 Ver insumos
                                </button>
                                <button
                                  onClick={() => abrirEditar(c)}
                                  title="Editar"
                                  style={{ backgroundColor: C.greenLight, color: C.green, border: `1px solid ${C.greenBorder}`, borderRadius: '7px', padding: '0.35rem 0.65rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600' }}
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => toggleActivo(c)}
                                  title={c.activo ? 'Desactivar' : 'Activar'}
                                  style={{ backgroundColor: c.activo ? C.amberLight : C.greenLight, color: c.activo ? C.amber : C.green, border: `1px solid ${c.activo ? C.amberBorder : C.greenBorder}`, borderRadius: '7px', padding: '0.35rem 0.65rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', whiteSpace: 'nowrap' }}
                                >
                                  {c.activo ? 'Desactivar' : 'Activar'}
                                </button>
                                <button
                                  onClick={() => { setConfirmEliminar(c); setErrorEliminar(''); }}
                                  title="Eliminar"
                                  style={{ backgroundColor: '#fdf0ef', color: C.errorColor, border: `1px solid ${C.errorBorder}`, borderRadius: '7px', padding: '0.35rem 0.65rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600' }}
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {visibleCount < centros.length && (
                    <div style={{ padding: '1rem 1.5rem', textAlign: 'center', borderTop: `1px solid ${C.greenBorder}` }}>
                      <button
                        onClick={() => setVisibleCount(v => v + 5)}
                        style={{ backgroundColor: C.greenLight, color: C.textMid, border: `1px solid ${C.greenBorder}`, borderRadius: '8px', padding: '0.5rem 1.25rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
                      >
                        Ver más ({centros.length - visibleCount} restante{centros.length - visibleCount !== 1 ? 's' : ''})
                      </button>
                    </div>
                  )}

                  {!cargando && centros.length > 0 && (
                    <div style={{ padding: '0.6rem 1rem', borderTop: `1px solid ${C.greenBorder}`, backgroundColor: C.greenLight, fontSize: '0.78rem', color: C.textLight, textAlign: 'right' }}>
                      {centros.length} centro{centros.length !== 1 ? 's' : ''} encontrado{centros.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>

      {/* Modal de crear/editar */}
      {modalAbierto && (
        <ModalCentro
          centro={centroEditando}
          onClose={cerrarModal}
          onGuardar={guardarCentro}
          guardando={guardando}
          errorModal={errorModal}
        />
      )}

      {/* Diálogo de confirmación de eliminación */}
      {confirmEliminar && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ backgroundColor: C.cardBg, borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: C.textDark, marginBottom: '0.6rem' }}>¿Eliminar centro?</h3>
            <p style={{ color: C.textMid, fontSize: '0.875rem', marginBottom: '1rem' }}>
              Estás por eliminar <strong>{confirmEliminar.nombre}</strong>. Esta acción no se puede deshacer.
            </p>
            {errorEliminar && (
              <div style={{ backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '8px', padding: '0.7rem 1rem', marginBottom: '1rem', color: C.errorColor, fontSize: '0.85rem' }}>
                {errorEliminar}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setConfirmEliminar(null); setErrorEliminar(''); }}
                style={{ backgroundColor: C.greenLight, color: C.textMid, border: `1px solid ${C.greenBorder}`, borderRadius: '8px', padding: '0.55rem 1rem', cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem' }}
              >
                Cancelar
              </button>
              <button
                onClick={eliminar}
                disabled={eliminando}
                style={{ backgroundColor: eliminando ? '#e5a09a' : C.errorColor, color: '#fff', border: 'none', borderRadius: '8px', padding: '0.55rem 1.2rem', cursor: eliminando ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '0.875rem' }}
              >
                {eliminando ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
