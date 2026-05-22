'use client';

import { useState, useEffect } from 'react';
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
      padding:         '0.2rem 0.6rem',
      borderRadius:    '6px',
      fontSize:        '0.78rem',
      fontWeight:      '600',
      backgroundColor: esRecuperado ? C.greenLight  : C.amberLight,
      color:           esRecuperado ? C.green        : C.amber,
      border:          `1px solid ${esRecuperado ? C.greenBorder : C.amberBorder}`,
      whiteSpace:      'nowrap',
    }}>
      {esRecuperado ? '✓ Recuperado' : '⏳ En centro asistencial'}
    </span>
  );
}

export default function ReportesAmbulanciaPage() {
  const router = useRouter();
  const [usuario,   setUsuario]   = useState(null);
  const [registros, setRegistros] = useState([]);
  const [cargando,  setCargando]  = useState(true);
  const [error,     setError]     = useState('');

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) { router.push('/login'); return; }

    const decoded = decodificarJWT(token);
    if (!decoded || (decoded.exp && Date.now() / 1000 > decoded.exp)) {
      Cookies.remove('token'); Cookies.remove('usuario');
      router.push('/login'); return;
    }
    if (decoded.rol !== 'ambulancia') {
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

    setCargando(true);
    setError('');
    axios.get(`${API}/api/reportes/mis-entregas`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setRegistros(data))
      .catch(() => setError('No se pudo cargar el reporte. Intente nuevamente.'))
      .finally(() => setCargando(false));
  }, [usuario]);

  if (!usuario) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.textMid }}>Cargando...</p>
      </div>
    );
  }

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

      <main style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: '700', color: C.textDark, marginBottom: '0.25rem' }}>Mis entregas</h1>
        <p style={{ color: C.textMid, fontSize: '0.875rem', marginBottom: '1.75rem' }}>
          Historial de insumos que has entregado y su estado actual de recuperación.
        </p>

        {error && (
          <div style={{ backgroundColor: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: '10px', padding: '0.9rem 1.25rem', marginBottom: '1.5rem', color: C.errorColor, fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <div style={{ backgroundColor: C.cardBg, border: `1px solid ${C.greenBorder}`, borderRadius: '16px', boxShadow: C.cardShadow, overflow: 'hidden' }}>
          {cargando ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight, fontSize: '0.9rem' }}>
              Cargando registros...
            </div>
          ) : registros.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight, fontSize: '0.9rem' }}>
              No tienes entregas registradas todavía.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: C.greenLight, borderBottom: `2px solid ${C.greenBorder}` }}>
                    {['Insumo', 'Centro asistencial', 'Fecha y hora', 'Estado', 'Médico'].map(col => (
                      <th key={col} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '600', color: C.textDark, whiteSpace: 'nowrap', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r, idx) => (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${C.greenBorder}`, backgroundColor: idx % 2 === 0 ? '#fff' : '#fafcfb' }}>
                      <td style={{ padding: '0.75rem 1rem', color: C.textDark, maxWidth: '220px' }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>{r.insumoNombre || '—'}</div>
                        {r.codigoInsumo && (
                          <div style={{ fontSize: '0.75rem', color: C.textLight, fontFamily: 'monospace' }}>{r.codigoInsumo}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: C.textMid, maxWidth: '200px' }}>
                        {nombreCentro(r)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: C.textMid, whiteSpace: 'nowrap' }}>
                        <div>{formatFecha(r.fecha)}</div>
                        <div style={{ fontSize: '0.78rem', color: C.textLight }}>{formatHora(r.hora)}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <EstadoBadge estado={r.estadoActual} />
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: C.textMid }}>
                        {r.nombreMedico || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!cargando && registros.length > 0 && (
            <div style={{ padding: '0.65rem 1rem', borderTop: `1px solid ${C.greenBorder}`, backgroundColor: C.greenLight, fontSize: '0.78rem', color: C.textLight, textAlign: 'right' }}>
              {registros.length} registro{registros.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
