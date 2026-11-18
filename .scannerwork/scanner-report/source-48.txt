'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Cookies from 'js-cookie';
import Link from 'next/link';
import InsumoSelector from '../_components/InsumoSelector';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
const inputBase  = {
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

export default function EntregarInsumoPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);
  const [centros,  setCentros]  = useState([]);
  const [ambulancias, setAmbulancias] = useState([]);
  const [ambulanciaSeleccionadaId, setAmbulanciaSeleccionadaId] = useState(null);

  const [insumoSeleccionado, setInsumoSeleccionado] = useState(null);

  const [form, setForm] = useState({
    codigoInsumo: '', nombrePaciente: '', historiaClinica: '',
    centroAsistencialId: '', centroOtro: '',
    fecha: getHoy(), hora: getHoraActual(),
    tripulacion: '', tripulantes: '', nombreMedico: '',
  });

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
    axios.get(`${API}/api/centros-asistenciales`).then(({ data }) => setCentros(data)).catch(() => {});
  }, []);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) return;
    axios.get(`${API}/api/ambulancias/activas`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setAmbulancias(data))
      .catch(() => {});
  }, []);

  const handleInsumoSeleccionado = (ins) => {
    setInsumoSeleccionado(ins);
    setForm(f => ({ ...f, codigoInsumo: ins ? (ins.codigo || '') : '' }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleAmbulanciaChange = (e) => {
    const codigo = e.target.value;
    const amb = ambulancias.find(a => a.codigo === codigo);
    setAmbulanciaSeleccionadaId(amb ? amb.id : null);
    setForm(f => ({ ...f, tripulacion: codigo }));
  };

  const centroSeleccionado = centros.find(c => String(c.id) === String(form.centroAsistencialId));
  const esOtro = centroSeleccionado?.esOtro === true;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.codigoInsumo || !insumoSeleccionado) { setError('Debe buscar y seleccionar un insumo válido.'); return; }
    if (!form.nombrePaciente.trim())   { setError('El nombre del paciente es requerido.'); return; }
    if (!form.historiaClinica.trim())  { setError('El número de historia clínica es requerido.'); return; }
    if (!form.centroAsistencialId)     { setError('Debe seleccionar un centro asistencial.'); return; }
    if (esOtro && !form.centroOtro.trim()) { setError('Por favor especifica el nombre del centro asistencial.'); return; }
    if (!form.fecha) { setError('La fecha es requerida.'); return; }
    if (!form.hora)  { setError('La hora es requerida.'); return; }

    setGuardando(true);
    try {
      const token = Cookies.get('token');
      const { tripulantes, ...formData } = form;
      const tripulacionCombinada = [form.tripulacion, tripulantes].filter(Boolean).join(' — ');
      await axios.post(`${API}/api/movimientos/entrega`, { ...formData, tripulacion: tripulacionCombinada }, { headers: { Authorization: `Bearer ${token}` } });
      setExito(true);
      setInsumoSeleccionado(null);
      setAmbulanciaSeleccionadaId(null);
      setForm({ codigoInsumo: '', nombrePaciente: '', historiaClinica: '', centroAsistencialId: '', centroOtro: '', fecha: getHoy(), hora: getHoraActual(), tripulacion: '', tripulantes: '', nombreMedico: '' });
      setTimeout(() => setExito(false), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrar la entrega. Intente nuevamente.');
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
        <h1 style={{ fontSize: '1.35rem', fontWeight: '700', color: C.textDark, marginBottom: '0.25rem' }}>Entregar insumo</h1>
        <p style={{ color: C.textMid, fontSize: '0.875rem', marginBottom: '1.75rem' }}>Registra la entrega de un insumo médico a un paciente.</p>

        {exito && (
          <div style={{ backgroundColor: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: '10px', padding: '0.9rem 1.25rem', marginBottom: '1.5rem', color: C.green, fontWeight: '600', fontSize: '0.9rem' }}>
            ✓ Insumo registrado exitosamente
          </div>
        )}

        <div style={{ backgroundColor: C.cardBg, border: `1px solid ${C.greenBorder}`, borderRadius: '16px', padding: '2rem', boxShadow: C.cardShadow }}>
          <form onSubmit={handleSubmit}>

            {/* 1. Insumo */}
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ ...labelStyle, marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: '600', color: C.textDark }}>Insumo</p>
              <InsumoSelector
                accentColor={C.green}
                accentLight={C.greenLight}
                accentBorder={C.greenBorder}
                onInsumoSeleccionado={handleInsumoSeleccionado}
                ambulanciaId={ambulanciaSeleccionadaId}
              />
            </div>

            {/* 2. Nombre paciente */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Nombre del paciente</label>
              <input type="text" name="nombrePaciente" value={form.nombrePaciente} onChange={handleChange} placeholder="Ej: Juan García" onFocus={onFocus} onBlur={onBlur} style={inputBase} />
            </div>

            {/* 3. Historia clínica */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Número de historia clínica</label>
              <input type="text" name="historiaClinica" value={form.historiaClinica} onChange={handleChange} placeholder="Ej: HC-123456" onFocus={onFocus} onBlur={onBlur} style={inputBase} />
            </div>

            {/* 4. Centro asistencial */}
            <div style={{ marginBottom: esOtro ? '0.5rem' : '1rem' }}>
              <label style={labelStyle}>Centro asistencial</label>
              <select name="centroAsistencialId" value={form.centroAsistencialId} onChange={handleChange} onFocus={onFocus} onBlur={onBlur} style={{ ...inputBase, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234a6a57' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.9rem center', paddingRight: '2.5rem', cursor: 'pointer' }}>
                <option value="">Seleccionar centro asistencial...</option>
                {centros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            {esOtro && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>¿Cuál centro asistencial?</label>
                <input type="text" name="centroOtro" value={form.centroOtro} onChange={handleChange} placeholder="Nombre del centro asistencial" onFocus={onFocus} onBlur={onBlur} style={inputBase} />
              </div>
            )}

            {/* 5 & 6. Fecha y hora */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle}>Fecha</label>
                <input type="date" name="fecha" value={form.fecha} onChange={handleChange} onFocus={onFocus} onBlur={onBlur} style={inputBase} />
              </div>
              <div>
                <label style={labelStyle}>Hora</label>
                <input type="time" name="hora" value={form.hora} onChange={handleChange} onFocus={onFocus} onBlur={onBlur} style={inputBase} />
              </div>
            </div>

            {/* 7. Tripulación */}
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={labelStyle}>Tripulación (ambulancia)</label>
              {ambulancias.length > 0 ? (
                <select name="tripulacion" value={form.tripulacion} onChange={handleAmbulanciaChange} onFocus={onFocus} onBlur={onBlur} style={{ ...inputBase, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234a6a57' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.9rem center', paddingRight: '2.5rem', cursor: 'pointer' }}>
                  <option value="">Seleccionar ambulancia...</option>
                  {ambulancias.map(a => (
                    <option key={a.id} value={a.codigo}>{a.codigo}{a.descripcion ? ` — ${a.descripcion}` : ''}</option>
                  ))}
                </select>
              ) : (
                <input type="text" name="tripulacion" value={form.tripulacion} onChange={handleChange} placeholder="Ej: AMB-01" onFocus={onFocus} onBlur={onBlur} style={inputBase} />
              )}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <input type="text" name="tripulantes" value={form.tripulantes} onChange={handleChange} placeholder="Ej: Juan Pérez, María López" onFocus={onFocus} onBlur={onBlur} style={inputBase} />
            </div>

            {/* 8. Médico */}
            <div style={{ marginBottom: '1.75rem' }}>
              <label style={labelStyle}>Nombre del médico</label>
              <input type="text" name="nombreMedico" value={form.nombreMedico} onChange={handleChange} placeholder="Ej: Dr. Carlos Ruiz" onFocus={onFocus} onBlur={onBlur} style={inputBase} />
            </div>

            {error && (
              <div style={{ backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '6px', padding: '0.65rem 1rem', marginBottom: '1rem', color: C.errorColor, fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={guardando}
              onMouseEnter={(e) => { if (!guardando) { e.target.style.backgroundColor = C.greenMid; e.target.style.boxShadow = '0 4px 14px rgba(45,134,83,0.35)'; } }}
              onMouseLeave={(e) => { if (!guardando) { e.target.style.backgroundColor = C.green;    e.target.style.boxShadow = '0 2px 8px rgba(45,134,83,0.2)'; } }}
              style={{ width: '100%', backgroundColor: guardando ? '#9dc9b3' : C.green, color: '#fff', fontWeight: '600', fontSize: '0.95rem', padding: '0.75rem', borderRadius: '8px', border: 'none', cursor: guardando ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s, box-shadow 0.2s', boxShadow: '0 2px 8px rgba(45,134,83,0.2)' }}
            >
              {guardando ? 'Guardando...' : 'Guardar entrega'}
            </button>

          </form>
        </div>
      </main>
    </div>
  );
}
