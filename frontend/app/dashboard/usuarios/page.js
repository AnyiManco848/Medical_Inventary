'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Cookies from 'js-cookie';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/* ── Paleta ──────────────────────────────────────────────────────── */
const C = {
  bg:          '#f0f5f2',
  green:       '#2d8653',
  greenLight:  '#e8f3ed',
  greenMid:    '#4a9e6e',
  greenBorder: '#b5d9c5',
  teal:        '#2d7da8',
  tealLight:   '#e8f2f8',
  tealBorder:  '#b5d0e0',
  textDark:    '#1a2e25',
  textMid:     '#4a6a57',
  textLight:   '#7a9e8a',
  cardBg:      '#ffffff',
  cardShadow:  '0 2px 16px rgba(45,134,83,0.08), 0 1px 3px rgba(0,0,0,0.05)',
  navBorder:   '#d5e8dc',
  errorColor:  '#c0392b',
  errorBg:     '#fdf0ef',
  errorBorder: '#f0b8b3',
};

/* ── JWT ─────────────────────────────────────────────────────────── */
function decodificarJWT(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

/* ── Estilos reutilizables ───────────────────────────────────────── */
const inputStyle = {
  width:           '100%',
  backgroundColor: C.greenLight,
  border:          `1px solid ${C.greenBorder}`,
  borderRadius:    '8px',
  padding:         '0.6rem 0.85rem',
  color:           C.textDark,
  fontSize:        '0.9rem',
  outline:         'none',
  transition:      'border-color 0.2s, box-shadow 0.2s',
};

const btnPrimary = {
  backgroundColor: C.green,
  color:           '#ffffff',
  border:          'none',
  borderRadius:    '8px',
  padding:         '0.6rem 1.25rem',
  cursor:          'pointer',
  fontWeight:      '600',
  fontSize:        '0.875rem',
  transition:      'background-color 0.2s',
};

const btnDanger = {
  backgroundColor: C.errorBg,
  color:           C.errorColor,
  border:          `1px solid ${C.errorBorder}`,
  borderRadius:    '6px',
  padding:         '0.35rem 0.7rem',
  cursor:          'pointer',
  fontSize:        '0.78rem',
  fontWeight:      '500',
};

const btnSecondary = {
  backgroundColor: C.tealLight,
  color:           C.teal,
  border:          `1px solid ${C.tealBorder}`,
  borderRadius:    '6px',
  padding:         '0.35rem 0.7rem',
  cursor:          'pointer',
  fontSize:        '0.78rem',
  fontWeight:      '500',
};

const ROLES = [
  { id: 1, nombre: 'admin' },
  { id: 2, nombre: 'ambulancia' },
];

/* ── EcgIcon ─────────────────────────────────────────────────────── */
const EcgIcon = () => (
  <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <polyline
      points="1,16 6,16 9,8 12,24 15,12 18,20 21,16 31,16"
      stroke="#2d8653"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

/* ── Ícono ojo SVG ───────────────────────────────────────────────── */
const EyeIcon = ({ open }) => open ? (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

/* ── Modal ───────────────────────────────────────────────────────── */
function ModalUsuario({ usuario, onGuardar, onCerrar }) {
  const esNuevo = !usuario?.id;
  const [form, setForm] = useState({
    nombre:            usuario?.nombre             || '',
    numero_ambulancia: usuario?.numero_ambulancia  || '',
    password:          '',
    roleId:            usuario?.rol?.id || usuario?.roleId || 1,
    activo:            usuario?.activo !== undefined ? usuario.activo : true,
    ambulanciaId:      usuario?.ambulancia?.id || usuario?.ambulanciaId || '',
  });
  const [error,           setError]           = useState('');
  const [cargando,        setCargando]        = useState(false);
  const [ambulancias,     setAmbulancias]     = useState([]);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  useEffect(() => {
    const token = Cookies.get('token');
    axios.get(`${API}/api/ambulancias`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(({ data }) => setAmbulancias(data))
      .catch(() => setAmbulancias([]));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFocus = (e) => {
    e.target.style.borderColor = C.green;
    e.target.style.boxShadow   = '0 0 0 3px rgba(45,134,83,0.15)';
  };
  const handleBlur = (e) => {
    e.target.style.borderColor = C.greenBorder;
    e.target.style.boxShadow   = 'none';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const token   = Cookies.get('token');
      const headers = { Authorization: `Bearer ${token}` };
      const rolNombre = ROLES.find((r) => r.id === parseInt(form.roleId))?.nombre;

      const payload = { ...form, roleId: parseInt(form.roleId) };
      if (!esNuevo && !payload.password) delete payload.password;

      if (rolNombre === 'admin') {
        payload.ambulanciaId = null;
      } else {
        payload.ambulanciaId = form.ambulanciaId ? parseInt(form.ambulanciaId) : null;
      }

      if (esNuevo) {
        await axios.post(`${API}/api/usuarios`, payload, { headers });
      } else {
        await axios.put(`${API}/api/usuarios/${usuario.id}`, payload, { headers });
      }
      onGuardar();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar usuario');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{
      position:        'fixed',
      inset:           0,
      backgroundColor: 'rgba(26,46,37,0.45)',
      backdropFilter:  'blur(4px)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      zIndex:          50,
      padding:         '1rem',
    }}>
      <div style={{
        backgroundColor: C.cardBg,
        border:          `1px solid ${C.greenBorder}`,
        borderRadius:    '16px',
        padding:         '2rem',
        width:           '100%',
        maxWidth:        '480px',
        boxShadow:       '0 8px 40px rgba(45,134,83,0.15)',
        maxHeight:       '90vh',
        overflowY:       'auto',
      }}>
        <h2 style={{ color: C.textDark, fontWeight: '700', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
          {esNuevo ? 'Nuevo usuario' : `Editar: ${usuario.nombre}`}
        </h2>

        {error && (
          <div style={{ backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', color: C.errorColor, fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Nombre */}
            <div>
              <label style={{ fontSize: '0.8rem', color: C.textMid, fontWeight: '500', display: 'block', marginBottom: '0.3rem' }}>Nombre</label>
              <input name="nombre" value={form.nombre} onChange={handleChange} required style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
            </div>

            {/* Número de Ambulancia / Usuario */}
            <div>
              <label style={{ fontSize: '0.8rem', color: C.textMid, fontWeight: '500', display: 'block', marginBottom: '0.3rem' }}>
                Número de Ambulancia / Usuario
              </label>
              <input
                name="numero_ambulancia"
                type="text"
                value={form.numero_ambulancia}
                onChange={handleChange}
                required
                placeholder="Ej: Ambulancia01"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Contraseña con mostrar/ocultar */}
            <div>
              <label style={{ fontSize: '0.8rem', color: C.textMid, fontWeight: '500', display: 'block', marginBottom: '0.3rem' }}>
                Contraseña{' '}
                {!esNuevo && <span style={{ color: C.textLight, fontWeight: '400' }}>(dejar vacío para no cambiar)</span>}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  name="password"
                  type={mostrarPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  required={esNuevo}
                  placeholder={esNuevo ? 'Mín. 8 chars, 1 número, 1 símbolo' : '••••••••'}
                  style={{ ...inputStyle, paddingRight: '2.5rem' }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword((v) => !v)}
                  style={{
                    position:   'absolute',
                    right:      '0.75rem',
                    top:        '50%',
                    transform:  'translateY(-50%)',
                    background: 'none',
                    border:     'none',
                    cursor:     'pointer',
                    color:      C.textLight,
                    padding:    0,
                    display:    'flex',
                    alignItems: 'center',
                  }}
                  tabIndex={-1}
                  aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <EyeIcon open={mostrarPassword} />
                </button>
              </div>
            </div>

            {/* Rol */}
            <div>
              <label style={{ fontSize: '0.8rem', color: C.textMid, fontWeight: '500', display: 'block', marginBottom: '0.3rem' }}>Rol</label>
              <select name="roleId" value={form.roleId} onChange={handleChange} style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
                onFocus={handleFocus} onBlur={handleBlur}>
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>

            {/* Ambulancia — visible solo cuando el rol es "ambulancia" */}
            {parseInt(form.roleId) === 2 && (
              <div>
                <label style={{ fontSize: '0.8rem', color: C.textMid, fontWeight: '500', display: 'block', marginBottom: '0.3rem' }}>
                  Ambulancia asignada (FK inventario)
                </label>
                <select
                  name="ambulanciaId"
                  value={form.ambulanciaId}
                  onChange={handleChange}
                  style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                >
                  <option value="">— Sin asignar —</option>
                  {ambulancias.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.codigo} {a.placa ? `· ${a.placa}` : ''}
                    </option>
                  ))}
                </select>
                {ambulancias.length === 0 && (
                  <p style={{ fontSize: '0.75rem', color: C.textLight, marginTop: '0.3rem' }}>
                    No hay ambulancias activas registradas.
                  </p>
                )}
              </div>
            )}

            {!esNuevo && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: C.textMid, fontSize: '0.875rem', cursor: 'pointer' }}>
                <input type="checkbox" name="activo" checked={form.activo} onChange={handleChange}
                  style={{ accentColor: C.green, width: '16px', height: '16px' }} />
                Usuario activo
              </label>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="submit" disabled={cargando}
              style={{ ...btnPrimary, opacity: cargando ? 0.65 : 1 }}>
              {cargando ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" onClick={onCerrar} style={btnSecondary}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Página principal ────────────────────────────────────────────── */
export default function UsuariosPage() {
  const router = useRouter();
  const [usuarios,     setUsuarios]     = useState([]);
  const [cargando,     setCargando]     = useState(true);
  const [error,        setError]        = useState('');
  const [modalUsuario, setModalUsuario] = useState(null);
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) { router.push('/login'); return; }
    const decoded = decodificarJWT(token);
    if (!decoded || decoded.rol !== 'admin') { router.push('/dashboard'); }
  }, [router]);

  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const token   = Cookies.get('token');
      const { data } = await axios.get(`${API}/api/usuarios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsuarios(data);
      setVisibleCount(5);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar usuarios');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);

  const desactivarUsuario = async (id) => {
    if (!confirm('¿Desactivar este usuario?')) return;
    try {
      const token = Cookies.get('token');
      await axios.delete(`${API}/api/usuarios/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      cargarUsuarios();
    } catch (err) {
      alert(err.response?.data?.message || 'Error al desactivar usuario');
    }
  };

  const cerrarSesion = () => {
    Cookies.remove('token'); Cookies.remove('usuario');
    router.push('/login');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg }}>
      {/* Navbar */}
      <header style={{
        backgroundColor: C.cardBg,
        borderBottom:    `1px solid ${C.navBorder}`,
        padding:         '0.9rem 2rem',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        position:        'sticky',
        top:             0,
        zIndex:          10,
        boxShadow:       '0 1px 4px rgba(45,134,83,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/dashboard" style={{ color: C.textMid, textDecoration: 'none', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            ← Regresar
          </Link>
          <span style={{ color: C.greenBorder }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px',
              backgroundColor: C.greenLight,
              border: `1px solid ${C.greenBorder}`,
              borderRadius: '8px',
            }}>
              <EcgIcon />
            </div>
            <span style={{ fontWeight: '700', fontSize: '1rem', color: C.textDark }}>
              Gestión de Usuarios
            </span>
          </div>
        </div>
        <button onClick={cerrarSesion}
          style={btnDanger}
          onMouseEnter={(e) => { e.target.style.backgroundColor = '#fce4e1'; }}
          onMouseLeave={(e) => { e.target.style.backgroundColor = C.errorBg; }}>
          Cerrar sesión
        </button>
      </header>

      <main style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '700', color: C.textDark, marginBottom: '0.2rem' }}>
              Usuarios
            </h1>
            <p style={{ color: C.textMid, fontSize: '0.875rem' }}>
              {usuarios.length} usuario(s) registrados
            </p>
          </div>
          <button onClick={() => setModalUsuario({})}
            style={btnPrimary}
            onMouseEnter={(e) => { e.target.style.backgroundColor = C.greenMid; }}
            onMouseLeave={(e) => { e.target.style.backgroundColor = C.green; }}>
            + Nuevo usuario
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '8px', padding: '1rem', color: C.errorColor, marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {/* Tabla */}
        <div style={{ backgroundColor: C.cardBg, border: `1px solid ${C.greenBorder}`, borderRadius: '12px', overflow: 'hidden', boxShadow: C.cardShadow }}>
          {cargando ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>Cargando...</div>
          ) : usuarios.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>No hay usuarios registrados</div>
          ) : (
            <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: C.greenLight, borderBottom: `1px solid ${C.greenBorder}` }}>
                  {['Nombre', 'Usuario', 'Rol', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} style={{
                      padding:       '0.75rem 1rem',
                      textAlign:     'left',
                      fontSize:      '0.72rem',
                      color:         C.textMid,
                      fontWeight:    '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.slice(0, visibleCount).map((u, idx) => (
                  <tr key={u.id} style={{
                    borderBottom: idx < Math.min(visibleCount, usuarios.length) - 1 ? `1px solid ${C.greenBorder}40` : 'none',
                    transition:   'background-color 0.15s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f7fbf8'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ padding: '0.85rem 1rem', color: C.textDark, fontWeight: '600', fontSize: '0.9rem' }}>
                      {u.nombre}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: C.textMid, fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      {u.numero_ambulancia || '—'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        backgroundColor: u.rol?.nombre === 'admin' ? C.greenLight : C.tealLight,
                        color:           u.rol?.nombre === 'admin' ? C.green      : C.teal,
                        border:          `1px solid ${u.rol?.nombre === 'admin' ? C.greenBorder : C.tealBorder}`,
                        borderRadius:    '6px',
                        padding:         '0.2rem 0.55rem',
                        fontSize:        '0.74rem',
                        fontWeight:      '600',
                        textTransform:   'capitalize',
                      }}>
                        {u.rol?.nombre || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        backgroundColor: u.activo ? '#e8f3ed' : '#fdf0ef',
                        color:           u.activo ? C.green   : C.errorColor,
                        border:          `1px solid ${u.activo ? C.greenBorder : C.errorBorder}`,
                        borderRadius:    '6px',
                        padding:         '0.2rem 0.55rem',
                        fontSize:        '0.74rem',
                        fontWeight:      '600',
                      }}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setModalUsuario(u)} style={btnSecondary}>Editar</button>
                        {u.activo && (
                          <button onClick={() => desactivarUsuario(u.id)} style={btnDanger}>Desactivar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleCount < usuarios.length && (
              <div style={{ padding: '1rem 1.5rem', textAlign: 'center', borderTop: `1px solid ${C.greenBorder}` }}>
                <button
                  onClick={() => setVisibleCount(v => v + 5)}
                  style={{ ...btnSecondary, fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}
                >
                  Ver más ({usuarios.length - visibleCount} restante{usuarios.length - visibleCount !== 1 ? 's' : ''})
                </button>
              </div>
            )}
            </>
          )}
        </div>
      </main>

      {/* Modal crear/editar */}
      {modalUsuario !== null && (
        <ModalUsuario
          usuario={modalUsuario.id ? modalUsuario : null}
          onGuardar={() => { setModalUsuario(null); cargarUsuarios(); }}
          onCerrar={() => setModalUsuario(null)}
        />
      )}
    </div>
  );
}
