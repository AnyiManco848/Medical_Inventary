'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Cookies from 'js-cookie';

/* ── Paleta ──────────────────────────────────────────────────────── */
const C = {
  bg:           '#f0f5f2',
  green:        '#2d8653',
  greenLight:   '#e8f3ed',
  greenMid:     '#4a9e6e',
  greenBorder:  '#b5d9c5',
  greenFocus:   '#2d8653',
  textDark:     '#1a2e25',
  textMid:      '#4a6a57',
  textLight:    '#7a9e8a',
  cardBg:       '#ffffff',
  cardShadow:   '0 4px 32px rgba(45,134,83,0.10), 0 1px 4px rgba(0,0,0,0.06)',
  errorColor:   '#c0392b',
  errorBg:      '#fdf0ef',
  errorBorder:  '#f0b8b3',
};

/* ── ECG canvas background ───────────────────────────────────────── */
function EcgBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const pattern = [
      [0,    0],
      [0.04, 0],
      [0.06, -0.12],
      [0.08, 0],
      [0.10, 0],
      [0.11, 0.06],
      [0.12, -1],
      [0.13, 0.25],
      [0.15, 0],
      [0.18, -0.18],
      [0.22, 0],
      [0.28, 0],
    ];

    const SEGMENT = 220;
    const SPEED   = 1.0;
    let offset    = 0;
    let raf;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const buildPoints = (startX, baseline, amplitude) =>
      pattern.map(([rx, ry]) => [startX + rx * SEGMENT, baseline - ry * amplitude]);

    const drawEcg = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const rows = Math.ceil(H / 110) + 1;
      for (let r = 0; r < rows; r++) {
        const baseline  = 70 + r * 110;
        const amplitude = 32;
        const cycles    = Math.ceil(W / SEGMENT) + 2;
        const phase     = -(offset % SEGMENT);

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(45,134,83,0.18)';
        ctx.lineWidth   = 1.5;
        ctx.lineJoin    = 'round';
        ctx.lineCap     = 'round';

        let first = true;
        for (let c = -1; c < cycles; c++) {
          const pts = buildPoints(phase + c * SEGMENT, baseline, amplitude);
          for (const [px, py] of pts) {
            if (first) { ctx.moveTo(px, py); first = false; }
            else          ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
      }

      offset += SPEED;
      raf = requestAnimationFrame(drawEcg);
    };

    resize();
    window.addEventListener('resize', resize);
    drawEcg();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
  );
}

/* ── Keyframes ───────────────────────────────────────────────────── */
const STYLES = `
  @keyframes logoPulse {
    0%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(45,134,83,0.25); }
    50%       { transform: scale(1.05); box-shadow: 0 0 0 8px rgba(45,134,83,0); }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  input:-webkit-autofill,
  input:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 1000px #f4fbf7 inset !important;
    -webkit-text-fill-color: #1a2e25 !important;
    caret-color: #2d8653;
  }
`;

/* ── Ícono ECG SVG ───────────────────────────────────────────────── */
const EcgIcon = () => (
  <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <polyline
      points="1,16 6,16 9,8 12,24 15,12 18,20 21,16 31,16"
      stroke="#2d8653"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

/* ── Ícono ojo SVG ───────────────────────────────────────────────── */
const EyeIcon = ({ open }) => open ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

/* ── Página principal ────────────────────────────────────────────── */
export default function LoginPage() {
  const router               = useRouter();
  const [usuario,            setUsuario]          = useState('');
  const [password,           setPassword]         = useState('');
  const [mostrarPassword,    setMostrarPassword]  = useState(false);
  const [error,              setError]            = useState('');
  const [cargando,           setCargando]         = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!usuario.trim()) {
      setError('El usuario no puede estar vacío.');
      return;
    }

    setCargando(true);
    try {
      const { data } = await axios.post('http://localhost:4000/api/auth/login', {
        numero_ambulancia: usuario.trim(),
        password,
      });
      Cookies.set('token',   data.token,                   { expires: 1 / 3, sameSite: 'strict' });
      Cookies.set('usuario', JSON.stringify(data.usuario), { expires: 1 / 3, sameSite: 'strict' });
      router.push('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión. Intente nuevamente.');
    } finally {
      setCargando(false);
    }
  };

  const inputStyle = {
    width:           '100%',
    backgroundColor: C.greenLight,
    border:          `1px solid ${C.greenBorder}`,
    borderRadius:    '8px',
    padding:         '0.65rem 0.9rem',
    color:           C.textDark,
    fontSize:        '0.95rem',
    outline:         'none',
    transition:      'border-color 0.2s, box-shadow 0.2s',
  };

  const labelStyle = {
    display:      'block',
    fontSize:     '0.8rem',
    fontWeight:   '500',
    color:        C.textMid,
    marginBottom: '0.4rem',
  };

  const onFocus = (e) => {
    e.target.style.borderColor = C.greenFocus;
    e.target.style.boxShadow   = '0 0 0 3px rgba(45,134,83,0.15)';
  };
  const onBlur = (e) => {
    e.target.style.borderColor = C.greenBorder;
    e.target.style.boxShadow   = 'none';
  };

  return (
    <>
      <style>{STYLES}</style>

      <div style={{ position: 'fixed', inset: 0, backgroundColor: C.bg, zIndex: -1 }} />
      <EcgBackground />

      <div style={{
        position:       'relative',
        zIndex:         1,
        minHeight:      '100vh',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '1.5rem',
        fontFamily:     'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>

          {/* Logo + título */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              display:         'inline-flex',
              alignItems:      'center',
              justifyContent:  'center',
              width:           '72px',
              height:          '72px',
              backgroundColor: C.greenLight,
              border:          `1.5px solid ${C.greenBorder}`,
              borderRadius:    '50%',
              marginBottom:    '1.25rem',
              animation:       'logoPulse 2.2s ease-in-out infinite',
            }}>
              <EcgIcon />
            </div>

            <h1 style={{
              fontSize:      '1.65rem',
              fontWeight:    '700',
              color:         C.textDark,
              letterSpacing: '0.5px',
              lineHeight:    '1.2',
            }}>
              Medical<span style={{ color: C.green }}>Inventary</span>
            </h1>
            <p style={{
              color:     C.textMid,
              marginTop: '0.4rem',
              fontSize:  '0.875rem',
            }}>
              Sistema de gestión de inventario médico
            </p>
          </div>

          {/* Card */}
          <div style={{
            backgroundColor: C.cardBg,
            border:          `1px solid ${C.greenBorder}`,
            borderRadius:    '16px',
            padding:         '2rem',
            boxShadow:       C.cardShadow,
          }}>
            <h2 style={{
              fontSize:     '1rem',
              fontWeight:   '600',
              color:        C.textDark,
              marginBottom: '1.5rem',
            }}>
              Iniciar sesión
            </h2>

            {/* Error */}
            {error && (
              <div style={{
                backgroundColor: C.errorBg,
                border:          `1px solid ${C.errorBorder}`,
                borderRadius:    '6px',
                padding:         '8px 12px',
                marginBottom:    '1rem',
                color:           C.errorColor,
                fontSize:        '0.85rem',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin}>
              {/* Usuario */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Usuario</label>
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  required
                  placeholder="Ej: Ambulancia01 o Administrador01"
                  onFocus={onFocus}
                  onBlur={onBlur}
                  style={inputStyle}
                  autoComplete="username"
                />
              </div>

              {/* Contraseña con mostrar/ocultar */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={mostrarPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    onFocus={onFocus}
                    onBlur={onBlur}
                    style={{ ...inputStyle, paddingRight: '2.5rem' }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword((v) => !v)}
                    style={{
                      position:        'absolute',
                      right:           '0.75rem',
                      top:             '50%',
                      transform:       'translateY(-50%)',
                      background:      'none',
                      border:          'none',
                      cursor:          'pointer',
                      color:           C.textLight,
                      padding:         0,
                      display:         'flex',
                      alignItems:      'center',
                    }}
                    tabIndex={-1}
                    aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    <EyeIcon open={mostrarPassword} />
                  </button>
                </div>
              </div>

              {/* Botón */}
              <button
                type="submit"
                disabled={cargando}
                onMouseEnter={(e) => {
                  if (!cargando) {
                    e.target.style.backgroundColor = C.greenMid;
                    e.target.style.boxShadow       = '0 4px 14px rgba(45,134,83,0.35)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!cargando) {
                    e.target.style.backgroundColor = C.green;
                    e.target.style.boxShadow       = '0 2px 8px rgba(45,134,83,0.2)';
                  }
                }}
                style={{
                  width:           '100%',
                  backgroundColor: cargando ? '#9dc9b3' : C.green,
                  color:           '#ffffff',
                  fontWeight:      '600',
                  fontSize:        '0.95rem',
                  padding:         '0.75rem',
                  borderRadius:    '8px',
                  border:          'none',
                  cursor:          cargando ? 'not-allowed' : 'pointer',
                  transition:      'background-color 0.2s, box-shadow 0.2s',
                  boxShadow:       '0 2px 8px rgba(45,134,83,0.2)',
                  letterSpacing:   '0.2px',
                }}
              >
                {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
