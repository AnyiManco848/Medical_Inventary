'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function InsumoSelector({ accentColor, accentLight, accentBorder, onInsumoSeleccionado }) {
  const [tabActiva,          setTabActiva]          = useState('codigo');
  const [query,              setQuery]              = useState('');
  const [sugerencias,        setSugerencias]        = useState([]);
  const [buscando,           setBuscando]           = useState(false);
  const [hasBuscado,         setHasBuscado]         = useState(false);
  const [insumoSeleccionado, setInsumoSeleccionado] = useState(null);
  const [error,              setError]              = useState('');
  const [camaraActiva,       setCamaraActiva]       = useState(false);
  const [errorCamara,        setErrorCamara]        = useState('');
  const [mostrarDropdown,    setMostrarDropdown]    = useState(false);

  const debounceRef = useRef(null);
  const escanerRef  = useRef(null);
  const wrapperRef  = useRef(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setMostrarDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Limpiar cámara al desmontar
  useEffect(() => {
    const ref = escanerRef;
    return () => {
      if (ref.current) { ref.current.stop().catch(() => {}); ref.current = null; }
    };
  }, []);

  // Autocomplete con debounce 300 ms
  const buscarSugerencias = useCallback((valor) => {
    clearTimeout(debounceRef.current);
    if (valor.trim().length < 2) {
      setSugerencias([]);
      setHasBuscado(false);
      setMostrarDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const token = Cookies.get('token');
        const { data } = await axios.get(`${API}/api/insumos/buscar`, {
          params: { q: valor.trim() },
          headers: { Authorization: `Bearer ${token}` },
        });
        setSugerencias(data);
        setHasBuscado(true);
        setMostrarDropdown(true);
      } catch {
        setSugerencias([]);
        setHasBuscado(true);
        setMostrarDropdown(true);
      } finally {
        setBuscando(false);
      }
    }, 300);
  }, []);

  // Búsqueda exacta por QR/código (Enter o escaneo)
  const buscarPorCodigo = useCallback(async (codigo) => {
    const c = String(codigo || '').trim();
    if (!c) return;
    setError('');
    setBuscando(true);
    try {
      const token = Cookies.get('token');
      const { data } = await axios.get(
        `${API}/api/insumos/qr/${encodeURIComponent(c)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setInsumoSeleccionado(data);
      setQuery(data.codigo);
      setSugerencias([]);
      setHasBuscado(false);
      setMostrarDropdown(false);
      onInsumoSeleccionado(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Insumo no encontrado con ese código.');
      setInsumoSeleccionado(null);
      onInsumoSeleccionado(null);
    } finally {
      setBuscando(false);
    }
  }, [onInsumoSeleccionado]);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setInsumoSeleccionado(null);
    setError('');
    setHasBuscado(false);
    if (val.trim().length < 2) setMostrarDropdown(false);
    onInsumoSeleccionado(null);
    buscarSugerencias(val);
  };

  const handleSeleccionar = (ins) => {
    setInsumoSeleccionado(ins);
    setQuery(ins.codigo);
    setSugerencias([]);
    setHasBuscado(false);
    setMostrarDropdown(false);
    onInsumoSeleccionado(ins);
  };

  const detenerCamara = async () => {
    if (escanerRef.current) {
      try { await escanerRef.current.stop(); } catch (_) {}
      escanerRef.current = null;
    }
    setCamaraActiva(false);
  };

  const activarCamara = async () => {
    setErrorCamara('');
    if (escanerRef.current) await detenerCamara();
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader-selector');
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decoded) => {
          await scanner.stop().catch(() => {});
          escanerRef.current = null;
          setCamaraActiva(false);
          buscarPorCodigo(decoded);
        },
        () => {}
      );
      escanerRef.current = scanner;
      setCamaraActiva(true);
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.message || '');
      setErrorCamara(
        msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')
          ? 'Permisos de cámara denegados. Habilita el acceso en la configuración del navegador.'
          : 'No se pudo activar la cámara. Verifica que tu dispositivo tenga cámara disponible.'
      );
    }
  };

  const handleCambiarTab = (tab) => {
    if (tab === tabActiva) return;
    detenerCamara();
    setTabActiva(tab);
    setInsumoSeleccionado(null);
    setError('');
    setQuery('');
    setSugerencias([]);
    setHasBuscado(false);
    setMostrarDropdown(false);
    onInsumoSeleccionado(null);
  };

  // Línea de detalle para el dropdown: código · especificaciones · ambulancia
  const lineaDetalle = (ins) => [
    ins.codigo,
    ins.especificaciones,
    ins.ambulancia?.codigo,
  ].filter(Boolean).join(' · ');

  const inputStyle = {
    width:           '100%',
    backgroundColor: accentLight,
    border:          `1px solid ${accentBorder}`,
    borderRadius:    '8px',
    padding:         '0.65rem 0.9rem',
    color:           '#1a2e25',
    fontSize:        '0.95rem',
    outline:         'none',
    boxSizing:       'border-box',
  };

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', backgroundColor: accentLight, borderRadius: '10px', padding: '0.3rem', marginBottom: '1rem' }}>
        {[['codigo', '⌨️ Buscar insumo'], ['qr', '📷 Escanear QR']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => handleCambiarTab(id)}
            style={{
              flex:            1,
              padding:         '0.55rem',
              borderRadius:    '7px',
              border:          'none',
              cursor:          'pointer',
              fontSize:        '0.85rem',
              fontWeight:      '600',
              transition:      'all 0.2s',
              backgroundColor: tabActiva === id ? accentColor : 'transparent',
              color:           tabActiva === id ? '#fff' : '#4a6a57',
              boxShadow:       tabActiva === id ? `0 2px 6px ${accentColor}40` : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: buscar con autocomplete */}
      {tabActiva === 'codigo' && (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => {
              if (hasBuscado && query.trim().length >= 2) setMostrarDropdown(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (sugerencias.length > 0) {
                  handleSeleccionar(sugerencias[0]);
                } else if (!hasBuscado) {
                  buscarPorCodigo(query);
                }
              }
              if (e.key === 'Escape') setMostrarDropdown(false);
            }}
            placeholder="Escribe nombre o código del insumo..."
            style={inputStyle}
          />

          {/* Indicador de carga */}
          {buscando && (
            <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#7a9e8a' }}>
              •••
            </span>
          )}

          {/* Dropdown */}
          {mostrarDropdown && !buscando && (
            <ul style={{
              position:        'absolute',
              top:             'calc(100% + 4px)',
              left:            0,
              right:           0,
              backgroundColor: '#fff',
              border:          `1px solid ${accentBorder}`,
              borderRadius:    '8px',
              boxShadow:       '0 4px 16px rgba(0,0,0,0.12)',
              listStyle:       'none',
              margin:          0,
              padding:         '0.3rem 0',
              zIndex:          50,
              maxHeight:       '260px',
              overflowY:       'auto',
            }}>
              {sugerencias.length === 0 ? (
                <li style={{ padding: '0.75rem 1rem', color: '#7a9e8a', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  No se encontraron insumos con ese nombre o código
                </li>
              ) : (
                sugerencias.map(ins => (
                  <li
                    key={ins.id}
                    onMouseDown={() => handleSeleccionar(ins)}
                    style={{ padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f0f5f2' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = accentLight; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <div style={{ fontWeight: '600', fontSize: '0.88rem', color: '#1a2e25' }}>
                      {ins.nombre}
                    </div>
                    <div style={{ fontSize: '0.77rem', color: accentColor, marginTop: '0.1rem' }}>
                      {lineaDetalle(ins)}
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      {/* Tab: QR */}
      {tabActiva === 'qr' && (
        <div>
          {!camaraActiva ? (
            <button
              type="button"
              onClick={activarCamara}
              style={{
                width:           '100%',
                padding:         '0.85rem',
                backgroundColor: accentLight,
                color:           accentColor,
                border:          `1.5px dashed ${accentBorder}`,
                borderRadius:    '10px',
                cursor:          'pointer',
                fontSize:        '0.9rem',
                fontWeight:      '600',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                gap:             '0.5rem',
              }}
            >
              📷 Activar cámara
            </button>
          ) : (
            <button
              type="button"
              onClick={detenerCamara}
              style={{
                width:           '100%',
                padding:         '0.55rem',
                backgroundColor: '#fdf0ef',
                color:           '#c0392b',
                border:          '1px solid #f0b8b3',
                borderRadius:    '8px',
                cursor:          'pointer',
                fontSize:        '0.85rem',
                fontWeight:      '600',
                marginBottom:    '0.75rem',
              }}
            >
              ✕ Detener cámara
            </button>
          )}
          {errorCamara && (
            <p style={{ color: '#c0392b', fontSize: '0.82rem', marginTop: '0.5rem', lineHeight: '1.4' }}>
              {errorCamara}
            </p>
          )}
          <div
            id="qr-reader-selector"
            style={{
              marginTop:    camaraActiva ? '0.75rem' : 0,
              borderRadius: '12px',
              overflow:     'hidden',
              minHeight:    camaraActiva ? '280px' : 0,
              border:       camaraActiva ? `1px solid ${accentBorder}` : 'none',
              transition:   'min-height 0.2s',
            }}
          />
        </div>
      )}

      {/* Error de búsqueda exacta */}
      {error && (
        <p style={{ color: '#c0392b', fontSize: '0.85rem', marginTop: '0.6rem' }}>
          {error}
        </p>
      )}

      {/* Confirmación de insumo seleccionado */}
      {insumoSeleccionado && (
        <div style={{
          marginTop:       '0.65rem',
          backgroundColor: accentLight,
          border:          `1px solid ${accentBorder}`,
          borderRadius:    '8px',
          padding:         '0.65rem 1rem',
          display:         'flex',
          alignItems:      'center',
          gap:             '0.6rem',
        }}>
          <span style={{ color: accentColor, fontWeight: '700', fontSize: '1.1rem' }}>✓</span>
          <div>
            <p style={{ color: accentColor, fontWeight: '600', fontSize: '0.9rem', margin: 0 }}>
              {insumoSeleccionado.nombre}
              {insumoSeleccionado.codigo && (
                <span style={{ fontWeight: '400', marginLeft: '0.35rem' }}>
                  ({insumoSeleccionado.codigo})
                </span>
              )}
            </p>
            {lineaDetalle(insumoSeleccionado) && lineaDetalle(insumoSeleccionado) !== insumoSeleccionado.codigo && (
              <p style={{ color: '#7a9e8a', fontSize: '0.78rem', margin: 0, marginTop: '0.1rem' }}>
                {lineaDetalle(insumoSeleccionado)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
