'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import axios from 'axios';
import Link from 'next/link';

const API = 'http://localhost:4000';

/* ── Paleta compartida (idéntica al resto del proyecto) ──────────────────── */
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

/* ── Helpers ────────────────────────────────────────────────────────────── */
function decodificarJWT(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

const estadoConfig = {
  activo:        { label: 'Activo',         bg: '#e8f3ed', color: '#2d8653', border: '#b5d9c5' },
  en_mal_estado: { label: 'Mal estado',     bg: '#fef9ec', color: '#b45309', border: '#f0d9a0' },
  dado_de_baja:  { label: 'Dado de baja',   bg: '#fdf0ef', color: '#c0392b', border: '#f0b8b3' },
  prestado:      { label: 'Prestado',       bg: '#e8f2f8', color: '#2d7da8', border: '#b5d0e0' },
};

/* ── EcgIcon ──────────────────────────────────────────────────────────── */
const EcgIcon = () => (
  <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <polyline points="1,16 6,16 9,8 12,24 15,12 18,20 21,16 31,16"
      stroke="#2d8653" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/* ── Navbar ───────────────────────────────────────────────────────────── */
function Navbar({ usuario, onCerrarSesion }) {
  return (
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
        <span style={{ color: C.greenBorder }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px', backgroundColor: C.greenLight,
            border: `1px solid ${C.greenBorder}`, borderRadius: '8px' }}>
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
              {usuario.nombre || usuario.cedula}
            </p>
            <p style={{ fontSize: '0.72rem', color: C.green, textTransform: 'capitalize', fontWeight: '500' }}>
              {usuario.rol}
            </p>
          </div>
        )}
        <button onClick={onCerrarSesion} style={{
          backgroundColor: C.redLight, border: `1px solid ${C.redBorder}`,
          borderRadius: '8px', padding: '0.45rem 0.9rem', color: C.red,
          fontSize: '0.82rem', cursor: 'pointer', fontWeight: '500',
        }}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}

/* ── EstadoBadge ─────────────────────────────────────────────────────── */
function EstadoBadge({ estado }) {
  const cfg = estadoConfig[estado] || estadoConfig.activo;
  return (
    <span style={{
      backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      borderRadius: '6px', padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: '600',
    }}>
      {cfg.label}
    </span>
  );
}

/* ── Botón reutilizable ──────────────────────────────────────────────── */
function Btn({ children, onClick, variant = 'primary', size = 'sm', disabled = false, type = 'button', style: extraStyle = {} }) {
  const variants = {
    primary:  { bg: C.green,      color: '#fff',     border: C.green },
    secondary:{ bg: C.tealLight,  color: C.teal,     border: C.tealBorder },
    danger:   { bg: C.redLight,   color: C.red,      border: C.redBorder },
    amber:    { bg: C.amberLight, color: C.amber,    border: C.amberBorder },
    ghost:    { bg: 'transparent', color: C.textMid, border: C.greenBorder },
  };
  const v = variants[variant] || variants.primary;
  const pad = size === 'sm' ? '0.35rem 0.75rem' : size === 'xs' ? '0.25rem 0.5rem' : '0.6rem 1.2rem';
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      backgroundColor: disabled ? '#e0e0e0' : v.bg,
      color: disabled ? '#999' : v.color,
      border: `1px solid ${disabled ? '#ccc' : v.border}`,
      borderRadius: '8px', padding: pad, fontSize: '0.8rem',
      fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'opacity 0.15s', ...extraStyle,
    }}>
      {children}
    </button>
  );
}

/* ── Overlay modal ───────────────────────────────────────────────────── */
function Modal({ children, onClose, width = '520px' }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(26,46,37,0.45)',
      backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        backgroundColor: C.cardBg, borderRadius: '16px', padding: '2rem',
        width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
      }}>
        {children}
      </div>
    </div>
  );
}

/* ── Campo de formulario ─────────────────────────────────────────────── */
function Campo({ label, children, error }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600',
        color: C.textMid, marginBottom: '0.35rem' }}>{label}</label>
      {children}
      {error && <p style={{ color: C.red, fontSize: '0.75rem', marginTop: '0.25rem' }}>{error}</p>}
    </div>
  );
}

function Input({ value, onChange, type = 'text', placeholder = '', min, max }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      min={min} max={max} style={{
        width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px',
        border: `1px solid ${C.greenBorder}`, fontSize: '0.875rem', color: C.textDark,
        outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff',
      }} />
  );
}

function Select({ value, onChange, children }) {
  return (
    <select value={value} onChange={onChange} style={{
      width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px',
      border: `1px solid ${C.greenBorder}`, fontSize: '0.875rem', color: C.textDark,
      outline: 'none', backgroundColor: '#fff', cursor: 'pointer',
    }}>
      {children}
    </select>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MODALES
══════════════════════════════════════════════════════════════════════ */

/* ── Modal Crear/Editar insumo ───────────────────────────────────────── */
function ModalInsumo({ insumo, token, onClose, onSaved }) {
  const esEdicion = Boolean(insumo);
  const [nombre, setNombre] = useState(insumo?.nombre || '');
  const [cantidad, setCantidad] = useState(insumo?.cantidad_disponible ?? 0);
  const [observaciones, setObservaciones] = useState(insumo?.observaciones || '');
  const [imagen, setImagen] = useState(null);
  const [preview, setPreview] = useState(insumo?.imagen_ruta ? `${API}${insumo.imagen_ruta}` : null);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const elegirImagen = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png'].includes(ext)) {
      setErrores(p => ({ ...p, imagen: 'Solo se permiten JPG o PNG' }));
      return;
    }
    setErrores(p => ({ ...p, imagen: '' }));
    setImagen(file);
    setPreview(URL.createObjectURL(file));
  };

  const validar = () => {
    const e = {};
    if (!nombre.trim()) e.nombre = 'El nombre es requerido';
    if (cantidad === '' || isNaN(Number(cantidad)) || Number(cantidad) < 0)
      e.cantidad = 'La cantidad debe ser 0 o mayor';
    return e;
  };

  const guardar = async () => {
    const e = validar();
    if (Object.keys(e).length > 0) { setErrores(e); return; }
    setEnviando(true); setError('');
    try {
      const formData = new FormData();
      formData.append('nombre', nombre.trim());
      formData.append('cantidad_disponible', String(Number(cantidad)));
      if (observaciones.trim()) formData.append('observaciones', observaciones.trim());
      if (imagen) formData.append('imagen', imagen);

      if (esEdicion) {
        await axios.put(`${API}/api/insumos/${insumo.id}`, formData, {
          headers: { ...authHeader(token), 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await axios.post(`${API}/api/insumos`, formData, {
          headers: { ...authHeader(token), 'Content-Type': 'multipart/form-data' },
        });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar el insumo');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: C.textDark, marginBottom: '1.5rem' }}>
        {esEdicion ? '✏️ Editar insumo' : '➕ Nuevo insumo'}
      </h2>

      <Campo label="Nombre *" error={errores.nombre}>
        <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Botiquín" />
      </Campo>

      <Campo label="Cantidad disponible *" error={errores.cantidad}>
        <Input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} min="0" />
      </Campo>

      <Campo label="Observaciones">
        <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
          placeholder="Notas opcionales..." rows={3} style={{
            width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px',
            border: `1px solid ${C.greenBorder}`, fontSize: '0.875rem', color: C.textDark,
            outline: 'none', resize: 'vertical', boxSizing: 'border-box',
          }} />
      </Campo>

      <Campo label="Imagen (JPG o PNG, máx. 5MB)" error={errores.imagen}>
        <input type="file" accept=".jpg,.jpeg,.png" onChange={elegirImagen}
          style={{ fontSize: '0.85rem', color: C.textDark }} />
        {preview && (
          <img src={preview} alt="Preview" style={{
            marginTop: '0.75rem', width: '100%', maxHeight: '180px',
            objectFit: 'cover', borderRadius: '8px', border: `1px solid ${C.greenBorder}`,
          }} />
        )}
      </Campo>

      {error && <p style={{ color: C.red, fontSize: '0.82rem', marginBottom: '1rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" onClick={guardar} disabled={enviando}>
          {enviando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear insumo'}
        </Btn>
      </div>
    </Modal>
  );
}

/* ── Modal Ver QR ────────────────────────────────────────────────────── */
function ModalQR({ insumo, token, onClose }) {
  const [qrUrl, setQrUrl] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Obtener QR como blob y crear URL local para el <img>
    axios.get(`${API}/api/insumos/${insumo.id}/qr`, {
      headers: authHeader(token),
      responseType: 'blob',
    }).then(res => {
      setQrUrl(URL.createObjectURL(res.data));
    }).catch(() => {}).finally(() => setCargando(false));
  }, [insumo.id, token]);

  const descargar = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `qr-${insumo.nombre.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    a.click();
  };

  return (
    <Modal onClose={onClose} width="380px">
      <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: C.textDark, marginBottom: '0.5rem' }}>
        Código QR — {insumo.nombre}
      </h2>
      <p style={{ fontSize: '0.78rem', color: C.textLight, marginBottom: '1.25rem', wordBreak: 'break-all' }}>
        UUID: {insumo.codigo_qr}
      </p>

      <div style={{ textAlign: 'center', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {cargando && <p style={{ color: C.textMid }}>Generando QR...</p>}
        {!cargando && qrUrl && (
          <img src={qrUrl} alt="Código QR" style={{
            width: '220px', height: '220px', border: `1px solid ${C.greenBorder}`, borderRadius: '8px',
          }} />
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <Btn variant="ghost" onClick={onClose}>Cerrar</Btn>
        <Btn variant="primary" onClick={descargar} disabled={!qrUrl}>⬇ Descargar PNG</Btn>
      </div>
    </Modal>
  );
}

/* ── Modal Movimiento (entrada/salida) ───────────────────────────────── */
function ModalMovimiento({ insumo, token, onClose, onSaved }) {
  const [tipo, setTipo] = useState('entrada');
  const [cantidad, setCantidad] = useState('');
  const [ambulancia, setAmbulancia] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const confirmar = async () => {
    if (!cantidad || isNaN(Number(cantidad)) || Number(cantidad) <= 0) {
      setError('Ingrese una cantidad válida mayor a 0'); return;
    }
    if (tipo === 'salida' && Number(cantidad) > insumo.cantidad_disponible) {
      setError(`Stock insuficiente. Disponible: ${insumo.cantidad_disponible}`); return;
    }
    setEnviando(true); setError('');
    try {
      await axios.post(`${API}/api/insumos/${insumo.id}/movimiento`, {
        tipo, cantidad: Number(cantidad),
        numero_ambulancia: ambulancia.trim() || undefined,
        motivo: motivo.trim() || undefined,
      }, { headers: authHeader(token) });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrar movimiento');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal onClose={onClose} width="440px">
      <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: C.textDark, marginBottom: '0.25rem' }}>
        Registrar movimiento
      </h2>
      <p style={{ fontSize: '0.85rem', color: C.textMid, marginBottom: '1.5rem' }}>
        {insumo.nombre} · Stock actual: <strong style={{ color: C.green }}>{insumo.cantidad_disponible}</strong>
      </p>

      <Campo label="Tipo de movimiento *">
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {['entrada', 'salida'].map(t => (
            <button key={t} type="button" onClick={() => setTipo(t)} style={{
              flex: 1, padding: '0.65rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600',
              fontSize: '0.875rem', border: `2px solid ${tipo === t ? (t === 'entrada' ? C.green : C.red) : C.greenBorder}`,
              backgroundColor: tipo === t ? (t === 'entrada' ? C.greenLight : C.redLight) : '#fff',
              color: tipo === t ? (t === 'entrada' ? C.green : C.red) : C.textMid,
            }}>
              {t === 'entrada' ? '📥 Entrada' : '📤 Salida'}
            </button>
          ))}
        </div>
      </Campo>

      <Campo label="Cantidad *">
        <Input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} min="1"
          placeholder={tipo === 'salida' ? `Máx. ${insumo.cantidad_disponible}` : ''} />
      </Campo>

      <Campo label="Número de ambulancia">
        <Input value={ambulancia} onChange={e => setAmbulancia(e.target.value)} placeholder="Ej: AMB-01" />
      </Campo>

      <Campo label="Motivo / descripción">
        <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Opcional" />
      </Campo>

      {error && <p style={{ color: C.red, fontSize: '0.82rem', marginBottom: '1rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant={tipo === 'entrada' ? 'primary' : 'danger'} onClick={confirmar} disabled={enviando}>
          {enviando ? 'Registrando...' : 'Confirmar'}
        </Btn>
      </div>
    </Modal>
  );
}

/* ── Modal Cambiar estado ────────────────────────────────────────────── */
function ModalEstado({ insumo, token, onClose, onSaved }) {
  const [estado, setEstado] = useState(insumo.estado);
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const confirmar = async () => {
    setEnviando(true); setError('');
    try {
      await axios.put(`${API}/api/insumos/${insumo.id}/estado`, {
        estado,
        cantidad: cantidad ? Number(cantidad) : 0,
        motivo: motivo.trim() || undefined,
      }, { headers: authHeader(token) });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cambiar estado');
    } finally {
      setEnviando(false);
    }
  };

  const estadosOpciones = [
    { value: 'activo',        label: 'Activo' },
    { value: 'en_mal_estado', label: 'En mal estado' },
    { value: 'dado_de_baja',  label: 'Dado de baja' },
    { value: 'prestado',      label: 'Prestado' },
  ];

  const requiereStock = ['en_mal_estado', 'dado_de_baja'].includes(estado);

  return (
    <Modal onClose={onClose} width="400px">
      <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: C.textDark, marginBottom: '0.25rem' }}>
        Cambiar estado
      </h2>
      <p style={{ fontSize: '0.85rem', color: C.textMid, marginBottom: '1.5rem' }}>
        {insumo.nombre} · Disponible: <strong style={{ color: C.green }}>{insumo.cantidad_disponible}</strong>
      </p>

      <Campo label="Nuevo estado *">
        <Select value={estado} onChange={e => setEstado(e.target.value)}>
          {estadosOpciones.map(op => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </Select>
      </Campo>

      {requiereStock && (
        <Campo label={`Cantidad afectada (máx. ${insumo.cantidad_disponible})`}>
          <Input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)}
            min="0" max={String(insumo.cantidad_disponible)} placeholder="0 = solo cambio de estado" />
        </Campo>
      )}

      <Campo label="Motivo / observación">
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
          placeholder="Descripción del cambio de estado..." style={{
            width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px',
            border: `1px solid ${C.greenBorder}`, fontSize: '0.875rem', color: C.textDark,
            outline: 'none', resize: 'vertical', boxSizing: 'border-box',
          }} />
      </Campo>

      {error && <p style={{ color: C.red, fontSize: '0.82rem', marginBottom: '1rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="amber" onClick={confirmar} disabled={enviando}>
          {enviando ? 'Guardando...' : 'Confirmar cambio'}
        </Btn>
      </div>
    </Modal>
  );
}

/* ── Modal Historial ─────────────────────────────────────────────────── */
function ModalHistorial({ insumo, token, onClose }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/insumos/${insumo.id}/historial`, { headers: authHeader(token) })
      .then(r => setDatos(r.data))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [insumo.id, token]);

  const fmtFecha = (f) => {
    if (!f) return '—';
    const d = new Date(f);
    if (isNaN(d.getTime())) return '—';
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  };

  return (
    <Modal onClose={onClose} width="700px">
      <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: C.textDark, marginBottom: '0.25rem' }}>
        Historial de movimientos
      </h2>
      <p style={{ fontSize: '0.85rem', color: C.textMid, marginBottom: '1.25rem' }}>{insumo.nombre}</p>

      {cargando && <p style={{ color: C.textMid, textAlign: 'center', padding: '2rem' }}>Cargando...</p>}

      {!cargando && datos && datos.movimientos.length === 0 && (
        <p style={{ color: C.textLight, textAlign: 'center', padding: '2rem' }}>
          Sin movimientos registrados
        </p>
      )}

      {!cargando && datos && datos.movimientos.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ backgroundColor: C.greenLight }}>
                {['Fecha', 'Tipo', 'Cantidad', 'Usuario', 'Ambulancia', 'Motivo'].map(h => (
                  <th key={h} style={{ padding: '0.55rem 0.75rem', textAlign: 'left',
                    color: C.textMid, fontWeight: '600', borderBottom: `1px solid ${C.greenBorder}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.movimientos.map((m, i) => (
                <tr key={m.id_movimiento} style={{ backgroundColor: i % 2 === 0 ? '#fff' : C.greenLight }}>
                  <td style={{ padding: '0.5rem 0.75rem', color: C.textDark }}>{fmtFecha(m.fecha)}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <span style={{
                      backgroundColor: m.tipo === 'entrada' ? C.greenLight : C.redLight,
                      color: m.tipo === 'entrada' ? C.green : C.red,
                      border: `1px solid ${m.tipo === 'entrada' ? C.greenBorder : C.redBorder}`,
                      borderRadius: '5px', padding: '0.15rem 0.45rem', fontWeight: '600',
                    }}>
                      {m.tipo === 'entrada' ? '📥 Entrada' : '📤 Salida'}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', color: C.textDark, fontWeight: '600' }}>{m.cantidad}</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: C.textMid }}>{m.usuario}</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: C.textMid }}>{m.numero_ambulancia || '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: C.textMid }}>{m.motivo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <Btn variant="ghost" onClick={onClose}>Cerrar</Btn>
      </div>
    </Modal>
  );
}

/* ── Modal Confirmar baja ────────────────────────────────────────────── */
function ModalConfirmarBaja({ insumo, token, onClose, onSaved }) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const confirmar = async () => {
    setEnviando(true); setError('');
    try {
      await axios.delete(`${API}/api/insumos/${insumo.id}`, {
        headers: authHeader(token), data: { motivo: motivo.trim() || undefined },
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al dar de baja');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal onClose={onClose} width="400px">
      <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: C.red, marginBottom: '0.5rem' }}>
        Dar de baja: {insumo.nombre}
      </h2>
      <p style={{ fontSize: '0.85rem', color: C.textMid, marginBottom: '1.25rem' }}>
        Esta acción marcará el insumo como &quot;dado de baja&quot; y reducirá su stock a 0. Es reversible
        cambiando el estado manualmente.
      </p>
      <Campo label="Motivo (opcional)">
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
          placeholder="Ej: Material vencido, reemplazado por otro..." style={{
            width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px',
            border: `1px solid ${C.greenBorder}`, fontSize: '0.875rem', color: C.textDark,
            outline: 'none', resize: 'vertical', boxSizing: 'border-box',
          }} />
      </Campo>
      {error && <p style={{ color: C.red, fontSize: '0.82rem', marginBottom: '1rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="danger" onClick={confirmar} disabled={enviando}>
          {enviando ? 'Procesando...' : 'Confirmar baja'}
        </Btn>
      </div>
    </Modal>
  );
}

/* ── Modal Escáner QR ────────────────────────────────────────────────── */
function ModalScanner({ token, onClose, onEncontrado }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const canvasRef = useRef(null);
  const [estado, setEstado] = useState('inicio'); // inicio | camera | manual | buscando | error
  const [codigoManual, setCodigoManual] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [soportaBarcodeDetector, setSoportaBarcodeDetector] = useState(false);

  useEffect(() => {
    setSoportaBarcodeDetector('BarcodeDetector' in window);
    return () => detenerCamera();
  }, []);

  const detenerCamera = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  };

  const iniciarCamera = async () => {
    setEstado('camera'); setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      if ('BarcodeDetector' in window) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        intervalRef.current = setInterval(async () => {
          try {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              detenerCamera();
              buscarQR(barcodes[0].rawValue);
            }
          } catch {}
        }, 300);
      } else {
        // Fallback: capturar frame con canvas y usar jsQR si está disponible
        const canvas = canvasRef.current;
        if (canvas) {
          intervalRef.current = setInterval(() => {
            const video = videoRef.current;
            if (!video || video.readyState < 2) return;
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
          }, 300);
        }
        // Mostrar input manual debajo del video
      }
    } catch {
      setEstado('error');
      setErrorMsg('No se pudo acceder a la cámara. Verifique los permisos del navegador.');
    }
  };

  const buscarQR = async (codigo) => {
    setEstado('buscando');
    try {
      const res = await axios.get(`${API}/api/insumos/qr/${encodeURIComponent(codigo)}`, {
        headers: authHeader(token),
      });
      onEncontrado(res.data);
    } catch (err) {
      setEstado('error');
      setErrorMsg(err.response?.status === 404
        ? 'No se encontró ningún insumo con ese código QR'
        : 'Error al consultar el código QR');
    }
  };

  const buscarManual = () => {
    if (!codigoManual.trim()) { setErrorMsg('Ingrese un código QR'); return; }
    buscarQR(codigoManual.trim());
  };

  return (
    <Modal onClose={() => { detenerCamera(); onClose(); }} width="480px">
      <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: C.textDark, marginBottom: '1rem' }}>
        Escanear código QR
      </h2>

      {estado === 'inicio' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: C.textMid, fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {soportaBarcodeDetector
              ? 'Activa la cámara para escanear el código QR del insumo.'
              : 'Tu navegador no soporta escaneo nativo. Ingresa el código manualmente.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
            {navigator.mediaDevices && (
              <Btn variant="primary" onClick={iniciarCamera} size="md">📷 Abrir cámara</Btn>
            )}
            <Btn variant="secondary" onClick={() => setEstado('manual')} size="md">⌨️ Ingresar código manualmente</Btn>
          </div>
        </div>
      )}

      {estado === 'camera' && (
        <div>
          <video ref={videoRef} playsInline muted style={{
            width: '100%', borderRadius: '8px', border: `2px solid ${C.green}`,
            backgroundColor: '#000', maxHeight: '320px', objectFit: 'cover',
          }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {!soportaBarcodeDetector && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.8rem', color: C.amber, marginBottom: '0.5rem' }}>
                ⚠ Escaneo automático no disponible en este navegador. Ingresa el código:
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Input value={codigoManual} onChange={e => setCodigoManual(e.target.value)}
                  placeholder="UUID del código QR" />
                <Btn variant="primary" onClick={buscarManual}>Buscar</Btn>
              </div>
            </div>
          )}
          <p style={{ fontSize: '0.78rem', color: C.textLight, marginTop: '0.75rem', textAlign: 'center' }}>
            Apunta la cámara al código QR del insumo
          </p>
          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <Btn variant="ghost" onClick={() => { detenerCamera(); setEstado('manual'); }}>
              Ingresar código manualmente
            </Btn>
          </div>
        </div>
      )}

      {estado === 'manual' && (
        <div>
          <Campo label="Código QR del insumo (UUID)" error={errorMsg}>
            <Input value={codigoManual} onChange={e => setCodigoManual(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          </Campo>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setEstado('inicio')}>Volver</Btn>
            <Btn variant="primary" onClick={buscarManual}>Buscar insumo</Btn>
          </div>
        </div>
      )}

      {estado === 'buscando' && (
        <p style={{ textAlign: 'center', color: C.textMid, padding: '2rem' }}>Buscando insumo...</p>
      )}

      {estado === 'error' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: C.red, marginBottom: '1rem' }}>{errorMsg}</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Btn variant="ghost" onClick={() => { setEstado('inicio'); setErrorMsg(''); }}>Volver</Btn>
            <Btn variant="secondary" onClick={() => { setEstado('manual'); setErrorMsg(''); }}>Ingresar manualmente</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ── Modal resultado QR: ver insumo encontrado y actuar ─────────────── */
function ModalResultadoQR({ insumo: insumoInicial, token, onClose, onRefresh }) {
  const [insumo, setInsumo] = useState(insumoInicial);
  const [accion, setAccion] = useState(null); // 'movimiento' | 'estado'

  const actualizar = async () => {
    const res = await axios.get(`${API}/api/insumos/${insumo.id}`, { headers: authHeader(token) });
    setInsumo(res.data);
    onRefresh();
    setAccion(null);
  };

  if (accion === 'movimiento') {
    return <ModalMovimiento insumo={insumo} token={token} onClose={() => setAccion(null)} onSaved={actualizar} />;
  }
  if (accion === 'estado') {
    return <ModalEstado insumo={insumo} token={token} onClose={() => setAccion(null)} onSaved={actualizar} />;
  }

  return (
    <Modal onClose={onClose} width="440px">
      <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: C.textDark, marginBottom: '1rem' }}>
        Insumo encontrado
      </h2>
      {insumo.imagen_ruta && (
        <img src={`${API}${insumo.imagen_ruta}`} alt={insumo.nombre} style={{
          width: '100%', height: '160px', objectFit: 'cover',
          borderRadius: '8px', marginBottom: '1rem', border: `1px solid ${C.greenBorder}`,
        }} />
      )}
      <p style={{ fontSize: '1.15rem', fontWeight: '700', color: C.textDark }}>{insumo.nombre}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.5rem 0 1rem' }}>
        <EstadoBadge estado={insumo.estado} />
        <span style={{ fontSize: '0.875rem', color: C.textMid }}>
          Disponible: <strong style={{ color: C.green }}>{insumo.cantidad_disponible}</strong>
        </span>
      </div>
      {insumo.observaciones && (
        <p style={{ fontSize: '0.8rem', color: C.textLight, marginBottom: '1rem' }}>{insumo.observaciones}</p>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Btn variant="primary" onClick={() => setAccion('movimiento')}>📦 Registrar movimiento</Btn>
        <Btn variant="amber" onClick={() => setAccion('estado')}>⚠ Cambiar estado</Btn>
        <Btn variant="ghost" onClick={onClose}>Cerrar</Btn>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
══════════════════════════════════════════════════════════════════════ */
export default function InventarioPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Estado de modales
  const [modalCrear, setModalCrear] = useState(false);
  const [insumoEditar, setInsumoEditar] = useState(null);
  const [insumoQR, setInsumoQR] = useState(null);
  const [insumoMovimiento, setInsumoMovimiento] = useState(null);
  const [insumoHistorial, setInsumoHistorial] = useState(null);
  const [insumoEstado, setInsumoEstado] = useState(null);
  const [insumoBaja, setInsumoBaja] = useState(null);
  const [modalScanner, setModalScanner] = useState(false);
  const [resultadoQR, setResultadoQR] = useState(null);

  /* ── Verificar sesión ──────────────────────────────────────────────── */
  useEffect(() => {
    const tkn = Cookies.get('token');
    if (!tkn) { router.push('/login'); return; }
    const decoded = decodificarJWT(tkn);
    if (!decoded || (decoded.exp && Date.now() / 1000 > decoded.exp)) {
      Cookies.remove('token'); Cookies.remove('usuario'); router.push('/login'); return;
    }
    setToken(tkn);
    try {
      const usr = Cookies.get('usuario');
      setUsuario(usr ? JSON.parse(usr) : { cedula: decoded.cedula, rol: decoded.rol });
    } catch {
      setUsuario({ cedula: decoded.cedula, rol: decoded.rol });
    }
  }, [router]);

  /* ── Cargar insumos ────────────────────────────────────────────────── */
  const cargarInsumos = useCallback(async (tkn) => {
    if (!tkn) return;
    setCargando(true); setErrorGlobal('');
    try {
      const { data } = await axios.get(`${API}/api/insumos`, { headers: authHeader(tkn) });
      setInsumos(data);
    } catch {
      setErrorGlobal('No se pudo cargar el inventario. Verifique la conexión con el servidor.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { if (token) cargarInsumos(token); }, [token, cargarInsumos]);

  const cerrarSesion = () => {
    Cookies.remove('token'); Cookies.remove('usuario'); router.push('/login');
  };

  const despuesDeGuardar = () => {
    setModalCrear(false); setInsumoEditar(null);
    setInsumoMovimiento(null); setInsumoEstado(null); setInsumoBaja(null);
    cargarInsumos(token);
  };

  /* ── Filtro de búsqueda ────────────────────────────────────────────── */
  const insumosFiltrados = insumos.filter(ins =>
    ins.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  /* ── Estado visual de stock ────────────────────────────────────────── */
  const colorStock = (cantidad, estado) => {
    if (estado === 'dado_de_baja') return C.textLight;
    if (cantidad === 0) return C.red;
    if (cantidad <= 3) return C.amber;
    return C.green;
  };

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
      <Navbar usuario={usuario} onCerrarSesion={cerrarSesion} />

      <main style={{ padding: '2rem', maxWidth: '1300px', margin: '0 auto' }}>

        {/* ── Encabezado ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: '700', color: C.textDark, marginBottom: '0.2rem' }}>
              Inventario de Insumos
            </h1>
            <p style={{ fontSize: '0.875rem', color: C.textMid }}>
              {insumos.length} insumo{insumos.length !== 1 ? 's' : ''} registrado{insumos.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Btn variant="secondary" onClick={() => setModalScanner(true)} size="md">📷 Escanear QR</Btn>
            {usuario.rol === 'admin' && (
              <Btn variant="primary" onClick={() => setModalCrear(true)} size="md">+ Nuevo insumo</Btn>
            )}
          </div>
        </div>

        {/* ── Buscador ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: '1.25rem' }}>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre..."
            style={{ padding: '0.6rem 1rem', borderRadius: '10px', border: `1px solid ${C.greenBorder}`,
              fontSize: '0.875rem', color: C.textDark, outline: 'none',
              width: '100%', maxWidth: '360px', backgroundColor: '#fff' }} />
        </div>

        {/* ── Error global ───────────────────────────────────────────── */}
        {errorGlobal && (
          <div style={{ backgroundColor: C.redLight, border: `1px solid ${C.redBorder}`,
            borderRadius: '10px', padding: '0.9rem 1.2rem', marginBottom: '1.25rem',
            color: C.red, fontSize: '0.875rem' }}>
            {errorGlobal}
          </div>
        )}

        {/* ── Tabla de insumos ───────────────────────────────────────── */}
        <div style={{ backgroundColor: C.cardBg, borderRadius: '14px',
          boxShadow: C.cardShadow, overflow: 'hidden' }}>

          {cargando ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: C.textMid }}>
              Cargando inventario...
            </div>
          ) : insumosFiltrados.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>
              {busqueda ? 'No se encontraron insumos con esa búsqueda.' : 'No hay insumos registrados aún.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: C.greenLight, borderBottom: `2px solid ${C.greenBorder}` }}>
                    {['Imagen', 'Nombre', 'Disponible', 'Estado', 'Observaciones', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left',
                        fontSize: '0.78rem', fontWeight: '700', color: C.textMid,
                        textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {insumosFiltrados.map((ins, i) => (
                    <tr key={ins.id} style={{
                      backgroundColor: i % 2 === 0 ? '#fff' : '#fafcfb',
                      borderBottom: `1px solid ${C.greenBorder}`,
                      transition: 'background-color 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = C.greenLight}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#fff' : '#fafcfb'}
                    >
                      {/* Imagen miniatura */}
                      <td style={{ padding: '0.65rem 1rem' }}>
                        {ins.imagen_ruta ? (
                          <img src={`${API}${ins.imagen_ruta}`} alt={ins.nombre}
                            style={{ width: '48px', height: '48px', objectFit: 'cover',
                              borderRadius: '8px', border: `1px solid ${C.greenBorder}` }} />
                        ) : (
                          <div style={{ width: '48px', height: '48px', borderRadius: '8px',
                            backgroundColor: C.greenLight, border: `1px solid ${C.greenBorder}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.2rem' }}>
                            📦
                          </div>
                        )}
                      </td>

                      {/* Nombre */}
                      <td style={{ padding: '0.65rem 1rem', fontWeight: '600', color: C.textDark }}>
                        {ins.nombre}
                      </td>

                      {/* Cantidad disponible */}
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: '700',
                          color: colorStock(ins.cantidad_disponible, ins.estado) }}>
                          {ins.cantidad_disponible}
                        </span>
                      </td>

                      {/* Estado */}
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <EstadoBadge estado={ins.estado} />
                      </td>

                      {/* Observaciones */}
                      <td style={{ padding: '0.65rem 1rem', color: C.textLight,
                        fontSize: '0.8rem', maxWidth: '200px' }}>
                        {ins.observaciones ? (
                          <span title={ins.observaciones}>
                            {ins.observaciones.length > 50
                              ? ins.observaciones.slice(0, 50) + '…'
                              : ins.observaciones}
                          </span>
                        ) : '—'}
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <Btn variant="secondary" size="xs" onClick={() => setInsumoMovimiento(ins)}>
                            📦 Movimiento
                          </Btn>
                          {ins.codigo_qr ? (
                            <Btn variant="ghost" size="xs" onClick={() => setInsumoQR(ins)}>
                              🔲 QR
                            </Btn>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: C.textLight,
                              padding: '0.25rem 0.5rem', border: `1px solid ${C.greenBorder}`,
                              borderRadius: '6px', cursor: 'not-allowed' }}>
                              Sin QR
                            </span>
                          )}
                          <Btn variant="ghost" size="xs" onClick={() => setInsumoHistorial(ins)}>
                            📋 Historial
                          </Btn>
                          {usuario.rol === 'admin' && (
                            <>
                              <Btn variant="amber" size="xs" onClick={() => setInsumoEstado(ins)}>
                                Estado
                              </Btn>
                              <Btn variant="ghost" size="xs" onClick={() => setInsumoEditar(ins)}>
                                ✏️
                              </Btn>
                              {ins.estado !== 'dado_de_baja' && (
                                <Btn variant="danger" size="xs" onClick={() => setInsumoBaja(ins)}>
                                  🗑
                                </Btn>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── Modales ────────────────────────────────────────────────────── */}
      {modalCrear && (
        <ModalInsumo token={token} onClose={() => setModalCrear(false)} onSaved={despuesDeGuardar} />
      )}
      {insumoEditar && (
        <ModalInsumo insumo={insumoEditar} token={token}
          onClose={() => setInsumoEditar(null)} onSaved={despuesDeGuardar} />
      )}
      {insumoQR && (
        <ModalQR insumo={insumoQR} token={token} onClose={() => setInsumoQR(null)} />
      )}
      {insumoMovimiento && (
        <ModalMovimiento insumo={insumoMovimiento} token={token}
          onClose={() => setInsumoMovimiento(null)} onSaved={despuesDeGuardar} />
      )}
      {insumoEstado && (
        <ModalEstado insumo={insumoEstado} token={token}
          onClose={() => setInsumoEstado(null)} onSaved={despuesDeGuardar} />
      )}
      {insumoHistorial && (
        <ModalHistorial insumo={insumoHistorial} token={token} onClose={() => setInsumoHistorial(null)} />
      )}
      {insumoBaja && (
        <ModalConfirmarBaja insumo={insumoBaja} token={token}
          onClose={() => setInsumoBaja(null)} onSaved={despuesDeGuardar} />
      )}
      {modalScanner && !resultadoQR && (
        <ModalScanner token={token} onClose={() => setModalScanner(false)}
          onEncontrado={(ins) => { setModalScanner(false); setResultadoQR(ins); }} />
      )}
      {resultadoQR && (
        <ModalResultadoQR insumo={resultadoQR} token={token}
          onClose={() => setResultadoQR(null)}
          onRefresh={() => cargarInsumos(token)} />
      )}
    </div>
  );
}
