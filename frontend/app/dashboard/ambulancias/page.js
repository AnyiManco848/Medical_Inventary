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
  tealMid:     '#3a8bbf',
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

const EcgIcon = () => (
  <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <polyline points="1,16 6,16 9,8 12,24 15,12 18,20 21,16 31,16"
      stroke="#2d8653" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

function Btn({ children, onClick, variant = 'primary', size = 'sm', disabled = false, type = 'button', style: extra = {} }) {
  const V = {
    primary:   { bg: C.green,      color: '#fff',     border: C.green      },
    secondary: { bg: C.tealLight,  color: C.teal,     border: C.tealBorder },
    success:   { bg: C.green,      color: '#fff',     border: C.green      },
    danger:    { bg: C.redLight,   color: C.red,      border: C.redBorder  },
    amber:     { bg: C.amberLight, color: C.amber,    border: C.amberBorder},
    ghost:     { bg: 'transparent', color: C.textMid, border: C.tealBorder },
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

function Modal({ children, onClose, width = '480px' }) {
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

function Campo({ label, children, error, hint }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600',
        color: C.textMid, marginBottom: '0.35rem' }}>{label}</label>
      {children}
      {hint  && <p style={{ color: C.textLight, fontSize: '0.74rem', marginTop: '0.25rem' }}>{hint}</p>}
      {error && <p style={{ color: C.red,       fontSize: '0.75rem', marginTop: '0.25rem' }}>{error}</p>}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px',
  border: `1px solid ${C.tealBorder}`, fontSize: '0.875rem', color: C.textDark,
  outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff',
};

/* ── Modal Crear / Editar Ambulancia ─────────────────────────────────────── */
function ModalAmbulancia({ ambulancia, token, onClose, onSaved }) {
  const esNuevo = !ambulancia;
  const [form, setForm] = useState({
    codigo:      ambulancia?.codigo      || '',
    placa:       ambulancia?.placa       || '',
    descripcion: ambulancia?.descripcion || '',
  });
  const [errores,  setErrores]  = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error,    setError]    = useState('');

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const validar = () => {
    const e = {};
    if (!form.codigo.trim()) e.codigo = 'El código es obligatorio';
    if (!form.placa.trim())  e.placa  = 'La placa es obligatoria';
    return e;
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    const e = validar();
    if (Object.keys(e).length > 0) { setErrores(e); return; }
    setEnviando(true); setError('');
    try {
      const payload = {
        codigo:      form.codigo.trim(),
        placa:       form.placa.trim().toUpperCase(),
        descripcion: form.descripcion.trim() || null,
      };
      if (esNuevo) {
        await axios.post(`${API}/api/ambulancias`, payload, { headers: authHeader(token) });
      } else {
        await axios.put(`${API}/api/ambulancias/${ambulancia.id}`, payload, { headers: authHeader(token) });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar la ambulancia');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: C.textDark, marginBottom: '1.5rem' }}>
        {esNuevo ? 'Nueva ambulancia' : `Editar: ${ambulancia.codigo}`}
      </h2>

      {error && (
        <div style={{ backgroundColor: C.redLight, border: `1px solid ${C.redBorder}`,
          borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem',
          color: C.red, fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={guardar}>
        <Campo label="Código *" error={errores.codigo} hint="Ej: AMB-01, AMB-21">
          <input
            value={form.codigo}
            onChange={set('codigo')}
            placeholder="AMB-21"
            style={inputStyle}
            autoFocus
          />
        </Campo>
        <Campo label="Placa *" error={errores.placa} hint="Se guardará en mayúsculas automáticamente">
          <input
            value={form.placa}
            onChange={set('placa')}
            placeholder="Ej: ABC-123"
            style={inputStyle}
          />
        </Campo>
        <Campo label="Descripción">
          <input
            value={form.descripcion}
            onChange={set('descripcion')}
            placeholder="Ej: Ambulancia básica zona norte"
            style={inputStyle}
          />
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

/* ── Página principal ────────────────────────────────────────────────────── */
export default function AmbulanciasPage() {
  const router = useRouter();
  const [usuario,       setUsuario]       = useState(null);
  const [token,         setToken]         = useState(null);
  const [ambulancias,   setAmbulancias]   = useState([]);
  const [cargando,      setCargando]      = useState(true);
  const [errorGlobal,   setErrorGlobal]   = useState('');
  const [busqueda,      setBusqueda]      = useState('');
  const [filtroEstado,  setFiltroEstado]  = useState('');   // '' | 'true' | 'false'
  const [visibleCount,  setVisibleCount]  = useState(5);
  const [modalAmb,      setModalAmb]      = useState(null); // null | {} (nueva) | {id,...} (editar)

  /* ── Auth ──────────────────────────────────────────────────────────────── */
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

  /* ── Cargar datos ──────────────────────────────────────────────────────── */
  const cargarAmbulancias = useCallback(async (tkn) => {
    if (!tkn) return;
    setCargando(true); setErrorGlobal('');
    try {
      const { data } = await axios.get(`${API}/api/ambulancias/todas`, {
        headers: authHeader(tkn),
      });
      setAmbulancias(data);
      setVisibleCount(5);
    } catch {
      setErrorGlobal('No se pudo cargar la lista de ambulancias.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { if (token) cargarAmbulancias(token); }, [token, cargarAmbulancias]);

  /* Resetear paginación al cambiar filtros */
  useEffect(() => { setVisibleCount(5); }, [busqueda, filtroEstado]);

  /* ── Acciones ──────────────────────────────────────────────────────────── */
  const toggleActiva = async (amb) => {
    const accion = amb.activa ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} la ambulancia "${amb.codigo}"?`)) return;
    try {
      await axios.patch(`${API}/api/ambulancias/${amb.id}/toggle`, {}, { headers: authHeader(token) });
      cargarAmbulancias(token);
    } catch (err) {
      alert(err.response?.data?.message || `Error al ${accion} la ambulancia`);
    }
  };

  const eliminar = async (amb) => {
    if (!confirm(`¿Eliminar permanentemente la ambulancia "${amb.codigo}"?\nEsta acción no se puede deshacer.`)) return;
    try {
      await axios.delete(`${API}/api/ambulancias/${amb.id}`, { headers: authHeader(token) });
      cargarAmbulancias(token);
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar la ambulancia');
    }
  };

  const cerrarSesion = () => {
    Cookies.remove('token'); Cookies.remove('usuario'); router.push('/login');
  };

  /* ── Filtrado client-side ──────────────────────────────────────────────── */
  const ambulanciasFiltradas = ambulancias.filter(a => {
    const q = busqueda.toLowerCase();
    const coincideBusqueda = !q ||
      a.codigo?.toLowerCase().includes(q) ||
      a.placa?.toLowerCase().includes(q) ||
      a.descripcion?.toLowerCase().includes(q);
    const coincideEstado = !filtroEstado ||
      (filtroEstado === 'true'  &&  a.activa) ||
      (filtroEstado === 'false' && !a.activa);
    return coincideBusqueda && coincideEstado;
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

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
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
          <span style={{ color: C.tealBorder }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', backgroundColor: C.tealLight,
              border: `1px solid ${C.tealBorder}`, borderRadius: '8px' }}>
              <EcgIcon />
            </div>
            <span style={{ fontWeight: '700', fontSize: '1rem', color: C.textDark }}>
              Ambulancias
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {usuario && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.85rem', color: C.textDark, fontWeight: '600', lineHeight: '1.2' }}>
                {usuario.nombre || usuario.numero_ambulancia}
              </p>
              <p style={{ fontSize: '0.72rem', color: C.teal, textTransform: 'capitalize', fontWeight: '500' }}>
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

      <main style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>

        {/* ── Encabezado ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '700', color: C.textDark, marginBottom: '0.2rem' }}>
              Ambulancias
            </h1>
            <p style={{ color: C.textMid, fontSize: '0.875rem' }}>
              {ambulanciasFiltradas.length} de {ambulancias.length} ambulancia(s) registrada(s)
            </p>
          </div>
          <Btn variant="primary" size="md" onClick={() => setModalAmb({})}>
            + Nueva ambulancia
          </Btn>
        </div>

        {/* ── Filtros ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '1.25rem',
          backgroundColor: C.cardBg, borderRadius: '12px', padding: '1rem', boxShadow: C.cardShadow }}>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por código, placa o descripción..."
            style={{ flex: 1, minWidth: '220px', padding: '0.55rem 0.9rem', borderRadius: '8px',
              border: `1px solid ${C.tealBorder}`, fontSize: '0.875rem', color: C.textDark,
              outline: 'none', backgroundColor: '#fff' }}
          />
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            style={{ padding: '0.55rem 0.75rem', borderRadius: '8px',
              border: `1px solid ${C.tealBorder}`, fontSize: '0.875rem',
              color: C.textDark, backgroundColor: '#fff', cursor: 'pointer' }}
          >
            <option value="">Todas</option>
            <option value="true">Solo activas</option>
            <option value="false">Solo inactivas</option>
          </select>
          {(busqueda || filtroEstado) && (
            <Btn variant="ghost" size="sm"
              onClick={() => { setBusqueda(''); setFiltroEstado(''); }}>
              ✕ Limpiar
            </Btn>
          )}
        </div>

        {/* ── Error global ─────────────────────────────────────────────────── */}
        {errorGlobal && (
          <div style={{ backgroundColor: C.redLight, border: `1px solid ${C.redBorder}`,
            borderRadius: '10px', padding: '0.9rem 1.2rem', marginBottom: '1.25rem',
            color: C.red, fontSize: '0.875rem' }}>
            {errorGlobal}
          </div>
        )}

        {/* ── Tabla ────────────────────────────────────────────────────────── */}
        <div style={{ backgroundColor: C.cardBg, borderRadius: '14px',
          boxShadow: C.cardShadow, overflow: 'hidden' }}>

          {cargando ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>
              Cargando ambulancias...
            </div>
          ) : ambulanciasFiltradas.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>
              {busqueda || filtroEstado
                ? 'No se encontraron ambulancias con esos filtros.'
                : 'No hay ambulancias registradas.'}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: C.greenLight, borderBottom: `2px solid ${C.greenBorder}` }}>
                      {['Código', 'Placa', 'Descripción', 'Estado', 'Acciones'].map(h => (
                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left',
                          fontSize: '0.73rem', fontWeight: '700', color: C.textMid,
                          textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ambulanciasFiltradas.slice(0, visibleCount).map((a, i) => (
                      <tr
                        key={a.id}
                        style={{
                          backgroundColor: i % 2 === 0 ? '#fff' : '#f8fbfd',
                          borderBottom: `1px solid ${C.tealBorder}40`,
                          transition: 'background-color 0.12s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = C.tealLight}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#fff' : '#f8fbfd'}
                      >
                        {/* Código */}
                        <td style={{ padding: '0.8rem 1rem' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.85rem',
                            fontWeight: '700', color: C.green }}>
                            {a.codigo}
                          </span>
                        </td>

                        {/* Placa */}
                        <td style={{ padding: '0.8rem 1rem' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.85rem',
                            color: C.textDark, fontWeight: '600' }}>
                            {a.placa || '—'}
                          </span>
                        </td>

                        {/* Descripción */}
                        <td style={{ padding: '0.8rem 1rem', color: C.textMid,
                          fontSize: '0.875rem', maxWidth: '280px' }}>
                          {a.descripcion || <span style={{ color: C.textLight }}>—</span>}
                        </td>

                        {/* Estado */}
                        <td style={{ padding: '0.8rem 1rem' }}>
                          <span style={{
                            backgroundColor: a.activa ? C.tealLight : C.redLight,
                            color:           a.activa ? C.teal      : C.red,
                            border:          `1px solid ${a.activa ? C.tealBorder : C.redBorder}`,
                            borderRadius:    '6px', padding: '0.2rem 0.6rem',
                            fontSize: '0.74rem', fontWeight: '600',
                          }}>
                            {a.activa ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td style={{ padding: '0.8rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <Btn variant="ghost" size="xs" onClick={() => setModalAmb(a)}>
                              Editar
                            </Btn>
                            <Btn
                              variant={a.activa ? 'amber' : 'success'}
                              size="xs"
                              onClick={() => toggleActiva(a)}
                            >
                              {a.activa ? 'Desactivar' : 'Activar'}
                            </Btn>
                            <Btn variant="danger" size="xs" onClick={() => eliminar(a)}>
                              Eliminar
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer: contador + ver más */}
              <div style={{ padding: '0.75rem 1.25rem', borderTop: `1px solid ${C.tealBorder}`,
                backgroundColor: C.tealLight, display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.78rem', color: C.textLight }}>
                  {ambulanciasFiltradas.length} resultado(s) ·{' '}
                  {ambulancias.filter(a => a.activa).length} activa(s)
                </span>
                {visibleCount < ambulanciasFiltradas.length && (
                  <Btn variant="ghost" size="sm" onClick={() => setVisibleCount(v => v + 5)}>
                    Ver más ({ambulanciasFiltradas.length - visibleCount} restante{ambulanciasFiltradas.length - visibleCount !== 1 ? 's' : ''})
                  </Btn>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ── Modal crear / editar ──────────────────────────────────────────── */}
      {modalAmb !== null && (
        <ModalAmbulancia
          ambulancia={modalAmb.id ? modalAmb : null}
          token={token}
          onClose={() => setModalAmb(null)}
          onSaved={() => { setModalAmb(null); cargarAmbulancias(token); }}
        />
      )}
    </div>
  );
}
