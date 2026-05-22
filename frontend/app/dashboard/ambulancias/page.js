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

function decodificarJWT(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

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

const btnActivar = {
  backgroundColor: C.greenLight,
  color:           C.green,
  border:          `1px solid ${C.greenBorder}`,
  borderRadius:    '6px',
  padding:         '0.35rem 0.7rem',
  cursor:          'pointer',
  fontSize:        '0.78rem',
  fontWeight:      '500',
};

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

function ModalAmbulancia({ ambulancia, onGuardar, onCerrar }) {
  const esNueva = !ambulancia?.id;
  const [form, setForm] = useState({
    codigo:      ambulancia?.codigo      || '',
    placa:       ambulancia?.placa       || '',
    descripcion: ambulancia?.descripcion || '',
  });
  const [error,    setError]    = useState('');
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'placa' ? value.toUpperCase() : value,
    }));
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
      const payload = {
        codigo:      form.codigo.trim(),
        placa:       form.placa.trim().toUpperCase(),
        descripcion: form.descripcion.trim() || null,
      };
      if (esNueva) {
        await axios.post(`${API}/api/ambulancias`, payload, { headers });
      } else {
        await axios.put(`${API}/api/ambulancias/${ambulancia.id}`, payload, { headers });
      }
      onGuardar();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar');
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
          {esNueva ? 'Nueva ambulancia' : `Editar: ${ambulancia.codigo}`}
        </h2>

        {error && (
          <div style={{ backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', color: C.errorColor, fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: C.textMid, fontWeight: '500', display: 'block', marginBottom: '0.3rem' }}>
                Código <span style={{ color: C.errorColor }}>*</span>
              </label>
              <input
                name="codigo"
                value={form.codigo}
                onChange={handleChange}
                required
                maxLength={20}
                placeholder="Ej: AMB-01"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: C.textMid, fontWeight: '500', display: 'block', marginBottom: '0.3rem' }}>
                Placa <span style={{ color: C.errorColor }}>*</span>
              </label>
              <input
                name="placa"
                value={form.placa}
                onChange={handleChange}
                required
                maxLength={20}
                placeholder="Ej: ABC-123"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: C.textMid, fontWeight: '500', display: 'block', marginBottom: '0.3rem' }}>
                Descripción
              </label>
              <input
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                maxLength={255}
                placeholder="Descripción opcional"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>
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

export default function AmbulanciaPage() {
  const router = useRouter();
  const [ambulancias,  setAmbulancias]  = useState([]);
  const [cargando,     setCargando]     = useState(true);
  const [error,        setError]        = useState('');
  const [modalAmb,     setModalAmb]     = useState(null);
  const [busqueda,     setBusqueda]     = useState('');
  const [filtroActiva, setFiltroActiva] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) { router.push('/login'); return; }
    const decoded = decodificarJWT(token);
    if (!decoded || decoded.rol !== 'admin') { router.push('/dashboard'); }
  }, [router]);

  const cargarAmbulancias = useCallback(async (q = '', activa = '') => {
    setCargando(true);
    setError('');
    try {
      const token  = Cookies.get('token');
      const params = {};
      if (q.trim())  params.q = q.trim();
      if (activa !== '') params.activa = activa;
      const { data } = await axios.get(`${API}/api/ambulancias/todas`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setAmbulancias(data);
      setVisibleCount(5);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar ambulancias');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarAmbulancias(); }, [cargarAmbulancias]);

  const handleBuscar = (e) => {
    e.preventDefault();
    cargarAmbulancias(busqueda, filtroActiva);
  };

  const handleLimpiar = () => {
    setBusqueda('');
    setFiltroActiva('');
    cargarAmbulancias('', '');
  };

  const handleToggleActiva = async (amb) => {
    const accion = amb.activa ? 'desactivar' : 'activar';
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} la ambulancia ${amb.codigo}?`)) return;
    try {
      const token = Cookies.get('token');
      await axios.patch(`${API}/api/ambulancias/${amb.id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      cargarAmbulancias(busqueda, filtroActiva);
    } catch (err) {
      alert(err.response?.data?.message || `Error al ${accion} la ambulancia`);
    }
  };

  const handleEliminar = async (amb) => {
    if (!confirm(`¿Eliminar la ambulancia ${amb.codigo} (${amb.placa})?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      const token = Cookies.get('token');
      await axios.delete(`${API}/api/ambulancias/${amb.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      cargarAmbulancias(busqueda, filtroActiva);
    } catch (err) {
      alert(err.response?.data?.message || 'Error al eliminar la ambulancia');
    }
  };

  const cerrarSesion = () => {
    Cookies.remove('token'); Cookies.remove('usuario');
    router.push('/login');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg }}>
      {/* Header */}
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
              Gestión de Ambulancias
            </span>
          </div>
        </div>
        <button
          onClick={cerrarSesion}
          style={btnDanger}
          onMouseEnter={(e) => { e.target.style.backgroundColor = '#fce4e1'; }}
          onMouseLeave={(e) => { e.target.style.backgroundColor = C.errorBg; }}
        >
          Cerrar sesión
        </button>
      </header>

      <main style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '700', color: C.textDark, marginBottom: '0.2rem' }}>
              Ambulancias
            </h1>
            <p style={{ color: C.textMid, fontSize: '0.875rem' }}>
              {ambulancias.length} ambulancia(s) registrada(s)
            </p>
          </div>
          <button
            onClick={() => setModalAmb({})}
            style={btnPrimary}
            onMouseEnter={(e) => { e.target.style.backgroundColor = C.greenMid; }}
            onMouseLeave={(e) => { e.target.style.backgroundColor = C.green; }}
          >
            + Nueva ambulancia
          </button>
        </div>

        {/* Filtros */}
        <form onSubmit={handleBuscar} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código, placa o descripción…"
            style={{ ...inputStyle, flex: '1', minWidth: '220px' }}
          />
          <select
            value={filtroActiva}
            onChange={(e) => setFiltroActiva(e.target.value)}
            style={{ ...inputStyle, width: 'auto', cursor: 'pointer', appearance: 'auto' }}
          >
            <option value="">Todos los estados</option>
            <option value="true">Solo activas</option>
            <option value="false">Solo inactivas</option>
          </select>
          <button
            type="submit"
            style={btnPrimary}
            onMouseEnter={(e) => { e.target.style.backgroundColor = C.greenMid; }}
            onMouseLeave={(e) => { e.target.style.backgroundColor = C.green; }}
          >
            Buscar
          </button>
          <button type="button" onClick={handleLimpiar} style={btnSecondary}>
            Limpiar
          </button>
        </form>

        {error && (
          <div style={{ backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '8px', padding: '1rem', color: C.errorColor, marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {/* Tabla */}
        <div style={{ backgroundColor: C.cardBg, border: `1px solid ${C.greenBorder}`, borderRadius: '12px', overflow: 'hidden', boxShadow: C.cardShadow }}>
          {cargando ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>Cargando...</div>
          ) : ambulancias.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>No hay ambulancias registradas</div>
          ) : (
            <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: C.greenLight, borderBottom: `1px solid ${C.greenBorder}` }}>
                  {['Código', 'Placa', 'Descripción', 'Estado', 'Acciones'].map((h) => (
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
                {ambulancias.slice(0, visibleCount).map((a, idx) => (
                  <tr
                    key={a.id}
                    style={{
                      borderBottom: idx < Math.min(visibleCount, ambulancias.length) - 1 ? `1px solid ${C.greenBorder}40` : 'none',
                      transition:   'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f7fbf8'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ padding: '0.85rem 1rem', color: C.textDark, fontWeight: '600', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                      {a.codigo}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: C.textMid, fontSize: '0.85rem', fontFamily: 'monospace' }}>
                      {a.placa}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: C.textMid, fontSize: '0.875rem', maxWidth: '240px' }}>
                      {a.descripcion || <span style={{ color: C.textLight, fontStyle: 'italic' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{
                        backgroundColor: a.activa ? C.greenLight : C.errorBg,
                        color:           a.activa ? C.green      : C.errorColor,
                        border:          `1px solid ${a.activa ? C.greenBorder : C.errorBorder}`,
                        borderRadius:    '6px',
                        padding:         '0.2rem 0.55rem',
                        fontSize:        '0.74rem',
                        fontWeight:      '600',
                      }}>
                        {a.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button onClick={() => setModalAmb(a)} style={btnSecondary}>
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleActiva(a)}
                          style={a.activa ? btnDanger : btnActivar}
                        >
                          {a.activa ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => handleEliminar(a)} style={btnDanger}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleCount < ambulancias.length && (
              <div style={{ padding: '1rem 1.5rem', textAlign: 'center', borderTop: `1px solid ${C.greenBorder}` }}>
                <button
                  onClick={() => setVisibleCount(v => v + 5)}
                  style={{ ...btnSecondary, fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}
                >
                  Ver más ({ambulancias.length - visibleCount} restante{ambulancias.length - visibleCount !== 1 ? 's' : ''})
                </button>
              </div>
            )}
            </>
          )}
        </div>
      </main>

      {modalAmb !== null && (
        <ModalAmbulancia
          ambulancia={modalAmb?.id ? modalAmb : null}
          onGuardar={() => { setModalAmb(null); cargarAmbulancias(busqueda, filtroActiva); }}
          onCerrar={() => setModalAmb(null)}
        />
      )}
    </div>
  );
}
