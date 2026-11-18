'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Cookies from 'js-cookie';
import Link from 'next/link';
import InsumoSelector from '../_components/InsumoSelector';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const MAX_MOTIVO = 500;
const MAX_FOTOS  = 5;

/* Paleta idéntica a entregar/page.js */
const C = {
  bg:          '#f0f5f2',
  green:       '#2d8653',
  greenLight:  '#e8f3ed',
  greenBorder: '#b5d9c5',
  greenMid:    '#4a9e6e',
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

/* Color del botón principal — igual que entregar/page.js */
const BTN = { color: '#2d8653', hover: '#4a9e6e', shadow: 'rgba(45,134,83,0.2)', shadowHover: 'rgba(45,134,83,0.35)', disabled: '#9dc9b3' };

const getHoy = () => new Date().toISOString().split('T')[0];
const getHoraActual = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function decodificarJWT(token) {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); }
  catch { return null; }
}

const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: '500', color: C.textMid, marginBottom: '0.4rem' };
const inputBase = {
  width: '100%', backgroundColor: C.greenLight, border: `1px solid ${C.greenBorder}`,
  borderRadius: '8px', padding: '0.65rem 0.9rem', color: C.textDark,
  fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box',
};
const onFocus = (e) => { e.target.style.borderColor = C.green;       e.target.style.boxShadow = '0 0 0 3px rgba(45,134,83,0.15)'; };
const onBlur  = (e) => { e.target.style.borderColor = C.greenBorder; e.target.style.boxShadow = 'none'; };

const EcgIcon = () => (
  <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <polyline points="1,16 6,16 9,8 12,24 15,12 18,20 21,16 31,16"
      stroke="#2d8653" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export default function DanoPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [usuario, setUsuario] = useState(null);
  const [ambulancias, setAmbulancias] = useState([]);
  const [ambulanciaSeleccionadaId, setAmbulanciaSeleccionadaId] = useState(null);

  const [insumoSeleccionado, setInsumoSeleccionado] = useState(null);
  const [tipo,     setTipo]     = useState('dano');
  const [motivo,   setMotivo]   = useState('');
  const [fecha,    setFecha]    = useState(getHoy());
  const [hora,     setHora]     = useState(getHoraActual());
  const [fotos,    setFotos]    = useState([]);
  const [previews, setPreviews] = useState([]);

  const [guardando, setGuardando] = useState(false);
  const [exito,     setExito]     = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) { router.push('/login'); return; }
    const decoded = decodificarJWT(token);
    if (!decoded || (decoded.exp && Date.now() / 1000 > decoded.exp)) {
      Cookies.remove('token'); Cookies.remove('usuario'); router.push('/login'); return;
    }
    try {
      const u = JSON.parse(Cookies.get('usuario') || '{}');
      setUsuario(u.id ? u : { numero_ambulancia: decoded.numero_ambulancia, rol: decoded.rol });
    } catch {
      setUsuario({ numero_ambulancia: decoded.numero_ambulancia, rol: decoded.rol });
    }
  }, [router]);

  useEffect(() => {
    return () => { previews.forEach(url => URL.revokeObjectURL(url)); };
  }, [previews]);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) return;
    axios.get(`${API}/api/ambulancias/activas`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setAmbulancias(data))
      .catch(() => {});
  }, []);

  const handleAgregarFotos = (e) => {
    const archivos = Array.from(e.target.files || []);
    if (!archivos.length) return;
    const nuevas = archivos.slice(0, MAX_FOTOS - fotos.length);
    setFotos(prev => [...prev, ...nuevas]);
    setPreviews(prev => [...prev, ...nuevas.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const handleEliminarFoto = (idx) => {
    URL.revokeObjectURL(previews[idx]);
    setFotos(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!insumoSeleccionado) { setError('Debe buscar y seleccionar un insumo válido.'); return; }
    if (!motivo.trim())      { setError('El motivo es requerido.'); return; }
    if (!fecha)              { setError('La fecha es requerida.'); return; }
    if (!hora)               { setError('La hora es requerida.'); return; }

    setGuardando(true);
    try {
      const token = Cookies.get('token');
      const fd = new FormData();
      fd.append('tipo',         tipo);
      fd.append('codigoInsumo', insumoSeleccionado.codigo || '');
      fd.append('motivo',       motivo.trim());
      fd.append('fecha',        fecha);
      fd.append('hora',         hora);
      fotos.forEach(f => fd.append('fotos', f));

      await axios.post(`${API}/api/movimientos/dano-perdida`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setExito(true);
      setInsumoSeleccionado(null);
      setAmbulanciaSeleccionadaId(null);
      setTipo('dano');
      setMotivo('');
      setFecha(getHoy());
      setHora(getHoraActual());
      previews.forEach(url => URL.revokeObjectURL(url));
      setFotos([]);
      setPreviews([]);
      setTimeout(() => setExito(false), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrar el reporte. Intente nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  if (!usuario) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.textMid }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
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

      <main style={{ padding: '2rem', maxWidth: '680px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: '700', color: C.textDark, marginBottom: '0.25rem' }}>Reportar daño o pérdida</h1>
        <p style={{ color: C.textMid, fontSize: '0.875rem', marginBottom: '1.75rem' }}>Informa sobre insumos dañados o perdidos durante la operación.</p>

        {exito && (
          <div style={{ backgroundColor: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: '10px', padding: '0.9rem 1.25rem', marginBottom: '1.5rem', color: C.green, fontWeight: '600', fontSize: '0.9rem' }}>
            ✓ Reporte registrado exitosamente
          </div>
        )}

        <div style={{ backgroundColor: C.cardBg, border: `1px solid ${C.greenBorder}`, borderRadius: '16px', padding: '2rem', boxShadow: C.cardShadow }}>
          <form onSubmit={handleSubmit}>

            {/* 1. Tipo: daño / pérdida */}
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ ...labelStyle, marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: '600', color: C.textDark }}>Tipo de reporte</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[['dano', '🔧 Daño'], ['perdida', '🔍 Pérdida']].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTipo(val)}
                    style={{
                      flex:            1,
                      padding:         '0.65rem',
                      borderRadius:    '8px',
                      border:          `1.5px solid ${tipo === val ? C.green : C.greenBorder}`,
                      cursor:          'pointer',
                      fontSize:        '0.9rem',
                      fontWeight:      '600',
                      transition:      'all 0.2s',
                      backgroundColor: tipo === val ? C.green : C.greenLight,
                      color:           tipo === val ? '#fff'  : C.textMid,
                      boxShadow:       tipo === val ? '0 2px 8px rgba(45,134,83,0.25)' : 'none',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Insumo */}
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ ...labelStyle, marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: '600', color: C.textDark }}>Insumo</p>
              {ambulancias.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={labelStyle}>Ambulancia</label>
                  <select
                    value={ambulanciaSeleccionadaId || ''}
                    onChange={(e) => {
                      const id = e.target.value ? parseInt(e.target.value, 10) : null;
                      setAmbulanciaSeleccionadaId(id);
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    style={{ ...inputBase, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234a6a57' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.9rem center', paddingRight: '2.5rem', cursor: 'pointer' }}
                  >
                    <option value="">Seleccionar ambulancia...</option>
                    {ambulancias.map(a => (
                      <option key={a.id} value={a.id}>{a.codigo}{a.descripcion ? ` — ${a.descripcion}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <InsumoSelector
                accentColor={C.green}
                accentLight={C.greenLight}
                accentBorder={C.greenBorder}
                onInsumoSeleccionado={setInsumoSeleccionado}
                ambulanciaId={ambulanciaSeleccionadaId}
              />
            </div>

            {/* 3. Motivo con contador */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Motivo</label>
                <span style={{ fontSize: '0.75rem', color: motivo.length > MAX_MOTIVO * 0.9 ? C.green : C.textLight }}>
                  {motivo.length}/{MAX_MOTIVO}
                </span>
              </div>
              <textarea
                value={motivo}
                onChange={(e) => { if (e.target.value.length <= MAX_MOTIVO) setMotivo(e.target.value); }}
                placeholder="Describe detalladamente qué ocurrió con el insumo..."
                rows={4}
                onFocus={onFocus}
                onBlur={onBlur}
                style={{ ...inputBase, resize: 'vertical', minHeight: '100px', fontFamily: 'inherit' }}
              />
            </div>

            {/* 4 & 5. Fecha y hora */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Fecha</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} onFocus={onFocus} onBlur={onBlur} style={inputBase} />
              </div>
              <div>
                <label style={labelStyle}>Hora</label>
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} onFocus={onFocus} onBlur={onBlur} style={inputBase} />
              </div>
            </div>

            {/* 6. Fotos de evidencia */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                <p style={{ ...labelStyle, marginBottom: 0, fontSize: '0.85rem', fontWeight: '600', color: C.textDark }}>Fotos de evidencia</p>
                <span style={{ fontSize: '0.75rem', color: C.textLight }}>{fotos.length}/{MAX_FOTOS}</span>
              </div>

              {previews.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
                  {previews.map((url, idx) => (
                    <div key={idx} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', aspectRatio: '1', border: `1px solid ${C.greenBorder}` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Evidencia ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => handleEliminarFoto(idx)}
                        style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {fotos.length < MAX_FOTOS && (
                <>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleAgregarFotos} style={{ display: 'none' }} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ width: '100%', padding: '0.75rem', backgroundColor: C.greenLight, color: C.green, border: `1.5px dashed ${C.greenBorder}`, borderRadius: '10px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    📷 {fotos.length === 0 ? 'Agregar fotos' : 'Agregar más fotos'} (JPG, PNG, WEBP · máx. 10 MB c/u)
                  </button>
                </>
              )}
            </div>

            {error && (
              <div style={{ backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '6px', padding: '0.65rem 1rem', marginBottom: '1rem', color: C.errorColor, fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={guardando}
              onMouseEnter={(e) => { if (!guardando) { e.target.style.backgroundColor = BTN.hover;  e.target.style.boxShadow = `0 4px 14px ${BTN.shadowHover}`; } }}
              onMouseLeave={(e) => { if (!guardando) { e.target.style.backgroundColor = BTN.color; e.target.style.boxShadow = `0 2px 8px ${BTN.shadow}`; } }}
              style={{ width: '100%', backgroundColor: guardando ? BTN.disabled : BTN.color, color: '#fff', fontWeight: '600', fontSize: '0.95rem', padding: '0.75rem', borderRadius: '8px', border: 'none', cursor: guardando ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s, box-shadow 0.2s', boxShadow: `0 2px 8px ${BTN.shadow}`, letterSpacing: '0.2px' }}
            >
              {guardando ? 'Enviando...' : `Registrar ${tipo === 'dano' ? 'daño' : 'pérdida'}`}
            </button>

          </form>
        </div>
      </main>
    </div>
  );
}
