'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import Link from 'next/link';

/* ── Paleta compartida ───────────────────────────────────────────── */
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
  navBorder:   '#d5e8dc',
  errorColor:  '#c0392b',
  errorBg:     '#fdf0ef',
};

/* ── JWT decoder ─────────────────────────────────────────────────── */
function decodificarJWT(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/* ── Card de acción ──────────────────────────────────────────────── */
function CardAccion({ titulo, descripcion, icono, accentColor, accentBg, accentBorder, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        backgroundColor: hover ? accentBg : C.cardBg,
        border:          `1px solid ${hover ? accentColor : C.greenBorder}`,
        borderRadius:    '14px',
        padding:         '1.75rem',
        cursor:          'pointer',
        textAlign:       'left',
        transition:      'all 0.2s',
        display:         'flex',
        flexDirection:   'column',
        gap:             '0.65rem',
        transform:       hover ? 'translateY(-2px)' : 'none',
        boxShadow:       hover ? `0 6px 20px ${accentColor}22` : C.cardShadow,
        width:           '100%',
      }}
    >
      <div style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        width:           '48px',
        height:          '48px',
        backgroundColor: accentBg,
        border:          `1px solid ${accentBorder}`,
        borderRadius:    '12px',
        fontSize:        '1.5rem',
      }}>
        {icono}
      </div>
      <div>
        <h3 style={{ color: C.textDark, fontWeight: '700', fontSize: '1rem', marginBottom: '0.25rem' }}>
          {titulo}
        </h3>
        <p style={{ color: C.textMid, fontSize: '0.85rem', lineHeight: '1.5' }}>
          {descripcion}
        </p>
      </div>
      <span style={{ color: accentColor, fontSize: '0.82rem', fontWeight: '600' }}>
        Acceder →
      </span>
    </button>
  );
}

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

/* ── Navbar compartido ───────────────────────────────────────────── */
function Navbar({ usuario, onCerrarSesion, backLink }) {
  return (
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {backLink && (
          <>
            <Link href={backLink.href} style={{ color: C.textMid, textDecoration: 'none', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              ← {backLink.label}
            </Link>
            <span style={{ color: C.greenBorder }}>|</span>
          </>
        )}
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
        <button
          onClick={onCerrarSesion}
          style={{
            backgroundColor: '#fdf0ef',
            border:          '1px solid #f0b8b3',
            borderRadius:    '8px',
            padding:         '0.45rem 0.9rem',
            color:           C.errorColor,
            fontSize:        '0.82rem',
            cursor:          'pointer',
            fontWeight:      '500',
            transition:      'background-color 0.2s',
          }}
          onMouseEnter={(e) => { e.target.style.backgroundColor = '#fce4e1'; }}
          onMouseLeave={(e) => { e.target.style.backgroundColor = '#fdf0ef'; }}
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}

/* ── Dashboard principal ─────────────────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) { router.push('/login'); return; }

    const decoded = decodificarJWT(token);
    if (!decoded) {
      Cookies.remove('token'); Cookies.remove('usuario');
      router.push('/login'); return;
    }
    if (decoded.exp && Date.now() / 1000 > decoded.exp) {
      Cookies.remove('token'); Cookies.remove('usuario');
      router.push('/login'); return;
    }

    const usuarioCookie = Cookies.get('usuario');
    if (usuarioCookie) {
      try { setUsuario(JSON.parse(usuarioCookie)); }
      catch { setUsuario({ id: decoded.id, numero_ambulancia: decoded.numero_ambulancia, rol: decoded.rol }); }
    } else {
      setUsuario({ id: decoded.id, numero_ambulancia: decoded.numero_ambulancia, rol: decoded.rol });
    }
  }, [router]);

  const cerrarSesion = () => {
    Cookies.remove('token'); Cookies.remove('usuario');
    router.push('/login');
  };

  if (!usuario) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.textMid }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C.bg }}>
      <Navbar usuario={usuario} onCerrarSesion={cerrarSesion} />

      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Encabezado */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.45rem', fontWeight: '700', color: C.textDark, marginBottom: '0.25rem' }}>
            Bienvenido, {usuario.nombre || usuario.numero_ambulancia}
          </h1>
          <p style={{ color: C.textMid, fontSize: '0.875rem' }}>
            Panel de control · Rol:{' '}
            <span style={{
              backgroundColor: usuario.rol === 'admin' ? C.greenLight : C.tealLight,
              color:           usuario.rol === 'admin' ? C.green      : C.teal,
              border:          `1px solid ${usuario.rol === 'admin' ? C.greenBorder : C.tealBorder}`,
              borderRadius:    '6px',
              padding:         '0.1rem 0.5rem',
              fontSize:        '0.8rem',
              fontWeight:      '600',
              textTransform:   'capitalize',
            }}>
              {usuario.rol}
            </span>
          </p>
        </div>

        {/* Panel ADMIN */}
        {usuario.rol === 'admin' && (
          <>
            <p style={{ fontSize: '0.75rem', fontWeight: '600', color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
              Administración
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '1rem' }}>
              <Link href="/dashboard/usuarios" style={{ textDecoration: 'none' }}>
                <CardAccion
                  titulo="Gestión de Usuarios"
                  descripcion="Crear, editar y desactivar usuarios del sistema."
                  icono="👥"
                  accentColor={C.green}
                  accentBg={C.greenLight}
                  accentBorder={C.greenBorder}
                />
              </Link>
              <Link href="/dashboard/inventario" style={{ textDecoration: 'none' }}>
                <CardAccion
                  titulo="Inventario de Insumos"
                  descripcion="Ver y gestionar el stock actual de insumos médicos."
                  icono="📦"
                  accentColor={C.teal}
                  accentBg={C.tealLight}
                  accentBorder={C.tealBorder}
                />
              </Link>
              <CardAccion
                titulo="Trazabilidad"
                descripcion="Registros de entrega y recuperación de insumos."
                icono="📋"
                accentColor={C.green}
                accentBg={C.greenLight}
                accentBorder={C.greenBorder}
                onClick={() => alert('Módulo en construcción')}
              />
              <CardAccion
                titulo="Ambulancias"
                descripcion="Gestionar flota de ambulancias activas."
                icono="🚑"
                accentColor={C.teal}
                accentBg={C.tealLight}
                accentBorder={C.tealBorder}
                onClick={() => alert('Módulo en construcción')}
              />
            </div>
          </>
        )}

        {/* Panel AMBULANCIA */}
        {usuario.rol === 'ambulancia' && (
          <>
            <p style={{ fontSize: '0.75rem', fontWeight: '600', color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
              Acciones disponibles
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.25rem' }}>
              <Link href="/dashboard/entregar" style={{ textDecoration: 'none' }}>
                <CardAccion
                  titulo="Entregar insumo"
                  descripcion="Registrar la entrega de insumos médicos a un hospital o unidad."
                  icono="📤"
                  accentColor={C.green}
                  accentBg={C.greenLight}
                  accentBorder={C.greenBorder}
                />
              </Link>
              <Link href="/dashboard/inventario" style={{ textDecoration: 'none' }}>
                <CardAccion
                  titulo="Recoger inventario"
                  descripcion="Registrar la recuperación de insumos previamente entregados."
                  icono="📥"
                  accentColor={C.teal}
                  accentBg={C.tealLight}
                  accentBorder={C.tealBorder}
                />
              </Link>
              <CardAccion
                titulo="Reportar daño o pérdida"
                descripcion="Informar sobre insumos dañados o perdidos durante la operación."
                icono="⚠️"
                accentColor={C.amber}
                accentBg={C.amberLight}
                accentBorder={C.amberBorder}
                onClick={() => alert('Módulo en construcción')}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
