'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import axios from 'axios';
import Link from 'next/link';

const API = 'http://localhost:4000';

/* ── Paleta ──────────────────────────────────────────────────────────────── */
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

/* ── Familias predefinidas (nombre visible → abreviatura) ─────────────── */
const FAMILIAS = [
  { nombre: 'Collarín cervical', abrev: 'COL' },
  { nombre: 'Venda',             abrev: 'VEN' },
  { nombre: 'Oxígeno',           abrev: 'OXI' },
  { nombre: 'Baxstrap',          abrev: 'BAX' },
  { nombre: 'Bloque',            abrev: 'BLQ' },
  { nombre: 'Botiquín',          abrev: 'BOT' },
  { nombre: 'Araña',             abrev: 'ARA' },
  { nombre: 'Estuche',           abrev: 'EST' },
  { nombre: 'Inmovilizador',     abrev: 'INM' },
  { nombre: 'Camilla',           abrev: 'CAM' },
  { nombre: 'Monitor',           abrev: 'MON' },
  { nombre: 'Desfibrilador',     abrev: 'DES' },
  { nombre: 'Otro',              abrev: 'GEN' },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function decodificarJWT(token) {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); }
  catch { return null; }
}

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

function formatFecha(fecha) {
  if (!fecha) return '—';
  // Si ya viene formateada como DD-MM-AAAA desde el backend, la retorna tal cual
  if (typeof fecha === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(fecha)) return fecha;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '—';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}-${mes}-${d.getFullYear()}`;
}

/* ── EcgIcon ──────────────────────────────────────────────────────────────── */
const EcgIcon = () => (
  <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <polyline points="1,16 6,16 9,8 12,24 15,12 18,20 21,16 31,16"
      stroke="#2d8653" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/* ── Navbar ───────────────────────────────────────────────────────────────── */
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
              {usuario.nombre || usuario.numero_ambulancia}
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

/* ── EstadoBadge ──────────────────────────────────────────────────────────── */
function EstadoBadge({ estado }) {
  const cfg = estado === 'activo'
    ? { label: 'Activo',       bg: C.greenLight, color: C.green, border: C.greenBorder }
    : { label: 'Dado de baja', bg: C.redLight,   color: C.red,   border: C.redBorder   };
  return (
    <span style={{
      backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      borderRadius: '6px', padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: '600',
    }}>{cfg.label}</span>
  );
}

/* ── Botón reutilizable ───────────────────────────────────────────────────── */
function Btn({ children, onClick, variant = 'primary', size = 'sm', disabled = false, type = 'button', style: extra = {} }) {
  const V = {
    primary:   { bg: C.green,      color: '#fff',     border: C.green      },
    secondary: { bg: C.tealLight,  color: C.teal,     border: C.tealBorder },
    danger:    { bg: C.redLight,   color: C.red,      border: C.redBorder  },
    amber:     { bg: C.amberLight, color: C.amber,    border: C.amberBorder},
    ghost:     { bg: 'transparent', color: C.textMid, border: C.greenBorder},
  };
  const v = V[variant] || V.primary;
  const pad = size === 'xs' ? '0.25rem 0.5rem' : size === 'sm' ? '0.35rem 0.75rem' : '0.6rem 1.2rem';
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      backgroundColor: disabled ? '#e0e0e0' : v.bg,
      color: disabled ? '#999' : v.color,
      border: `1px solid ${disabled ? '#ccc' : v.border}`,
      borderRadius: '8px', padding: pad, fontSize: '0.8rem',
      fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'opacity 0.15s', ...extra,
    }}>{children}</button>
  );
}

/* ── Modal overlay ────────────────────────────────────────────────────────── */
function Modal({ children, onClose, width = '520px' }) {
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

/* ── Campo de formulario ──────────────────────────────────────────────────── */
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

const inputStyle = {
  width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px',
  border: `1px solid ${C.greenBorder}`, fontSize: '0.875rem', color: C.textDark,
  outline: 'none', boxSizing: 'border-box', backgroundColor: '#fff',
};

function Input({ value, onChange, type = 'text', placeholder = '', min, max, readOnly = false }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      min={min} max={max} readOnly={readOnly}
      style={{ ...inputStyle, backgroundColor: readOnly ? '#f5f5f5' : '#fff' }} />
  );
}

function Textarea({ value, onChange, placeholder = '', rows = 3 }) {
  return (
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      style={{ ...inputStyle, resize: 'vertical' }} />
  );
}

function SelectField({ value, onChange, children }) {
  return (
    <select value={value} onChange={onChange}
      style={{ ...inputStyle, cursor: 'pointer' }}>
      {children}
    </select>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL CREAR INSUMO
══════════════════════════════════════════════════════════════════════════════ */
function ModalCrear({ token, ambulancias, onClose, onSaved }) {
  const [nombre, setNombre]             = useState('');
  const [familiaIdx, setFamiliaIdx]     = useState(0);
  const [especificaciones, setEspec]    = useState('');
  const [ambulanciaId, setAmbulanciaId] = useState('');
  const [cantidad, setCantidad]         = useState(1);
  const [errores, setErrores]           = useState({});
  const [enviando, setEnviando]         = useState(false);
  const [error, setError]               = useState('');

  const familia = FAMILIAS[familiaIdx];

  const validar = () => {
    const e = {};
    if (!nombre.trim()) e.nombre = 'El nombre es requerido';
    return e;
  };

  const guardar = async () => {
    const e = validar();
    if (Object.keys(e).length > 0) { setErrores(e); return; }
    setEnviando(true); setError('');
    try {
      await axios.post(`${API}/api/insumos`, {
        nombre: nombre.trim(),
        familia: familia.nombre,
        familia_abrev: familia.abrev,
        especificaciones: especificaciones.trim() || undefined,
        ambulanciaId: ambulanciaId || undefined,
        cantidad,
      }, { headers: authHeader(token) });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear el insumo');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: C.textDark, marginBottom: '1.5rem' }}>
        Nuevo insumo
      </h2>

      <Campo label="Nombre del insumo *" error={errores.nombre}>
        <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Collar cervical talla S" />
      </Campo>

      <Campo label="Familia *">
        <SelectField value={familiaIdx} onChange={e => setFamiliaIdx(Number(e.target.value))}>
          {FAMILIAS.map((f, i) => (
            <option key={f.abrev} value={i}>{f.nombre} ({f.abrev})</option>
          ))}
        </SelectField>
        <p style={{ fontSize: '0.75rem', color: C.textLight, marginTop: '0.25rem' }}>
          Código generado: <strong style={{ color: C.green }}>INS-{familia.abrev}-###</strong>
        </p>
      </Campo>

      <Campo label="Especificaciones">
        <Input value={especificaciones} onChange={e => setEspec(e.target.value)}
          placeholder="Ej: Talla S, 4 pulgadas, adulto..." />
      </Campo>

      <Campo label="Ambulancia asignada">
        <SelectField value={ambulanciaId} onChange={e => setAmbulanciaId(e.target.value)}>
          <option value="">— Sin ambulancia asignada —</option>
          {ambulancias.map(a => (
            <option key={a.id} value={a.id}>{a.codigo}{a.descripcion ? ` — ${a.descripcion}` : ''}</option>
          ))}
        </SelectField>
      </Campo>

      <Campo label="Cantidad de unidades a crear">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button type="button"
            onClick={() => setCantidad(q => Math.max(1, q - 1))}
            style={{
              width: '36px', height: '36px', borderRadius: '8px', fontSize: '1.2rem',
              border: `1px solid ${C.greenBorder}`, backgroundColor: C.greenLight,
              cursor: 'pointer', color: C.green, fontWeight: '700',
            }}>−</button>
          <span style={{ fontSize: '1.3rem', fontWeight: '700', color: C.textDark,
            minWidth: '2rem', textAlign: 'center' }}>{cantidad}</span>
          <button type="button"
            onClick={() => setCantidad(q => Math.min(50, q + 1))}
            style={{
              width: '36px', height: '36px', borderRadius: '8px', fontSize: '1.2rem',
              border: `1px solid ${C.greenBorder}`, backgroundColor: C.greenLight,
              cursor: 'pointer', color: C.green, fontWeight: '700',
            }}>+</button>
          <span style={{ fontSize: '0.8rem', color: C.textLight }}>
            {cantidad > 1 ? `Se crearán ${cantidad} registros independientes` : 'Un registro individual'}
          </span>
        </div>
      </Campo>

      {error && <p style={{ color: C.red, fontSize: '0.82rem', marginBottom: '1rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" onClick={guardar} disabled={enviando}>
          {enviando ? 'Creando...' : cantidad > 1 ? `Crear ${cantidad} unidades` : 'Crear insumo'}
        </Btn>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL EDITAR INSUMO
══════════════════════════════════════════════════════════════════════════════ */
function ModalEditar({ insumo, token, ambulancias, onClose, onSaved }) {
  const [nombre, setNombre]             = useState(insumo.nombre || '');
  const [especificaciones, setEspec]    = useState(insumo.especificaciones || '');
  const [ambulanciaId, setAmbulanciaId] = useState(insumo.ambulanciaId ? String(insumo.ambulanciaId) : '');
  const [observaciones, setObs]         = useState(insumo.observaciones || '');
  const [enviando, setEnviando]         = useState(false);
  const [error, setError]               = useState('');

  const guardar = async () => {
    if (!nombre.trim()) { setError('El nombre no puede estar vacío'); return; }
    setEnviando(true); setError('');
    try {
      await axios.put(`${API}/api/insumos/${insumo.id}`, {
        nombre: nombre.trim(),
        especificaciones: especificaciones.trim() || undefined,
        ambulanciaId: ambulanciaId || null,
        observaciones: observaciones.trim() || undefined,
      }, { headers: authHeader(token) });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar cambios');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: C.textDark, marginBottom: '0.5rem' }}>
        Editar insumo
      </h2>
      <p style={{ fontSize: '0.82rem', color: C.textLight, marginBottom: '1.5rem', fontFamily: 'monospace' }}>
        {insumo.codigo || `#${insumo.id}`} · {insumo.familia || '—'}
      </p>

      <Campo label="Nombre *">
        <Input value={nombre} onChange={e => setNombre(e.target.value)} />
      </Campo>

      <Campo label="Especificaciones">
        <Input value={especificaciones} onChange={e => setEspec(e.target.value)}
          placeholder="Talla, tamaño, modelo..." />
      </Campo>

      <Campo label="Ambulancia asignada">
        <SelectField value={ambulanciaId} onChange={e => setAmbulanciaId(e.target.value)}>
          <option value="">— Sin ambulancia —</option>
          {ambulancias.map(a => (
            <option key={a.id} value={a.id}>{a.codigo}{a.descripcion ? ` — ${a.descripcion}` : ''}</option>
          ))}
        </SelectField>
      </Campo>

      <Campo label="Observaciones">
        <Textarea value={observaciones} onChange={e => setObs(e.target.value)} placeholder="Notas opcionales..." />
      </Campo>

      {error && <p style={{ color: C.red, fontSize: '0.82rem', marginBottom: '1rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" onClick={guardar} disabled={enviando}>
          {enviando ? 'Guardando...' : 'Guardar cambios'}
        </Btn>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL DAR DE BAJA
══════════════════════════════════════════════════════════════════════════════ */
function ModalBaja({ insumo, token, onClose, onSaved }) {
  const [motivo, setMotivo]   = useState('');
  const [foto, setFoto]       = useState(null);
  const [preview, setPreview] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError]     = useState('');

  const elegirFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const confirmar = async () => {
    if (!motivo.trim()) { setError('El motivo de baja es requerido'); return; }
    if (!foto) { setError('La foto de evidencia es requerida'); return; }

    setEnviando(true); setError('');
    try {
      const fd = new FormData();
      fd.append('motivo', motivo.trim());
      fd.append('foto', foto);
      await axios.post(`${API}/api/insumos/${insumo.id}/baja`, fd, {
        headers: { ...authHeader(token), 'Content-Type': 'multipart/form-data' },
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al dar de baja');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal onClose={onClose} width="460px">
      <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: C.red, marginBottom: '0.5rem' }}>
        Dar de baja
      </h2>
      <p style={{ fontSize: '0.85rem', color: C.textMid, marginBottom: '1.5rem' }}>
        <strong>{insumo.nombre}</strong>
        {insumo.codigo && (
          <span style={{ marginLeft: '0.5rem', fontFamily: 'monospace', color: C.textLight }}>
            {insumo.codigo}
          </span>
        )}
      </p>

      <Campo label="Motivo de baja *">
        <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
          placeholder="Ej: Material vencido, daño físico irrecuperable..." />
      </Campo>

      <Campo label="Foto de evidencia *">
        <input type="file" accept=".jpg,.jpeg,.png" onChange={elegirFoto}
          style={{ fontSize: '0.85rem', color: C.textDark }} />
        {preview && (
          <img src={preview} alt="Evidencia" style={{
            marginTop: '0.75rem', width: '100%', maxHeight: '180px',
            objectFit: 'cover', borderRadius: '8px', border: `1px solid ${C.greenBorder}`,
          }} />
        )}
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

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL REASIGNAR AMBULANCIA
══════════════════════════════════════════════════════════════════════════════ */
function ModalReasignar({ insumo, token, ambulancias, onClose, onSaved }) {
  const [ambulanciaId, setAmbulanciaId] = useState('');
  const [tipo, setTipo]                 = useState('permanente');
  const [notas, setNotas]               = useState('');
  const [fechaDev, setFechaDev]         = useState('');
  const [enviando, setEnviando]         = useState(false);
  const [error, setError]               = useState('');

  const confirmar = async () => {
    if (tipo === 'prestamo' && !fechaDev) {
      setError('Indique la fecha de devolución esperada para el préstamo'); return;
    }
    setEnviando(true); setError('');
    try {
      await axios.post(`${API}/api/insumos/${insumo.id}/reasignar`, {
        ambulancia_nueva_id: ambulanciaId || null,
        tipo,
        notas: notas.trim() || undefined,
        fecha_devolucion_esperada: fechaDev || undefined,
      }, { headers: authHeader(token) });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al reasignar');
    } finally {
      setEnviando(false);
    }
  };

  const ambAnterior = insumo.ambulancia?.codigo || 'Sin ambulancia';

  return (
    <Modal onClose={onClose} width="460px">
      <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: C.textDark, marginBottom: '0.5rem' }}>
        Reasignar ambulancia
      </h2>
      <p style={{ fontSize: '0.85rem', color: C.textMid, marginBottom: '1.5rem' }}>
        <strong>{insumo.nombre}</strong>
        {insumo.codigo && (
          <span style={{ marginLeft: '0.5rem', fontFamily: 'monospace', color: C.textLight }}>
            {insumo.codigo}
          </span>
        )}
      </p>

      <div style={{
        backgroundColor: C.amberLight, border: `1px solid ${C.amberBorder}`,
        borderRadius: '8px', padding: '0.65rem 1rem', marginBottom: '1.25rem',
        fontSize: '0.82rem', color: C.amber,
      }}>
        Ambulancia actual: <strong>{ambAnterior}</strong>
      </div>

      <Campo label="Ambulancia destino">
        <SelectField value={ambulanciaId} onChange={e => setAmbulanciaId(e.target.value)}>
          <option value="">— Sin ambulancia (retirar) —</option>
          {ambulancias.map(a => (
            <option key={a.id} value={a.id}>{a.codigo}{a.descripcion ? ` — ${a.descripcion}` : ''}</option>
          ))}
        </SelectField>
      </Campo>

      <Campo label="Tipo de reasignación">
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {[
            { val: 'permanente', label: 'Permanente' },
            { val: 'prestamo',   label: 'Préstamo temporal' },
          ].map(({ val, label }) => (
            <button key={val} type="button" onClick={() => setTipo(val)} style={{
              flex: 1, padding: '0.6rem', borderRadius: '8px', cursor: 'pointer',
              fontWeight: '600', fontSize: '0.85rem',
              border: `2px solid ${tipo === val ? C.green : C.greenBorder}`,
              backgroundColor: tipo === val ? C.greenLight : '#fff',
              color: tipo === val ? C.green : C.textMid,
            }}>{label}</button>
          ))}
        </div>
      </Campo>

      {tipo === 'prestamo' && (
        <Campo label="Fecha de devolución esperada *">
          <Input type="date" value={fechaDev} onChange={e => setFechaDev(e.target.value)} />
        </Campo>
      )}

      <Campo label="Notas">
        <Textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
          placeholder="Motivo del traslado, detalles..." />
      </Campo>

      {error && <p style={{ color: C.red, fontSize: '0.82rem', marginBottom: '1rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn variant="primary" onClick={confirmar} disabled={enviando}>
          {enviando ? 'Reasignando...' : 'Confirmar reasignación'}
        </Btn>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL QR — tarjeta imprimible
══════════════════════════════════════════════════════════════════════════════ */
function ModalQR({ insumo, token, onClose }) {
  const [qrUrl, setQrUrl]     = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/insumos/${insumo.id}/qr`, {
      headers: authHeader(token),
      responseType: 'blob',
    }).then(res => setQrUrl(URL.createObjectURL(res.data)))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [insumo.id, token]);

  const descargar = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `qr-${(insumo.codigo || insumo.id)}.png`;
    a.click();
  };

  const imprimir = () => window.print();

  return (
    <Modal onClose={onClose} width="420px">
      {/* Tarjeta visible en pantalla y en impresión */}
      <div id="qr-card" style={{
        border: `2px solid ${C.greenBorder}`, borderRadius: '12px',
        padding: '1.5rem', backgroundColor: '#fff', textAlign: 'center',
      }}>
        <p style={{ fontSize: '0.7rem', fontWeight: '700', color: C.textLight,
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
          Medical Inventary
        </p>
        <p style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: '700',
          color: C.green, marginBottom: '0.25rem' }}>
          {insumo.codigo || `#${insumo.id}`}
        </p>
        <p style={{ fontSize: '1rem', fontWeight: '700', color: C.textDark, marginBottom: '0.1rem' }}>
          {insumo.nombre}
        </p>
        {insumo.familia && (
          <p style={{ fontSize: '0.82rem', color: C.textMid, marginBottom: '0.1rem' }}>{insumo.familia}</p>
        )}
        {insumo.especificaciones && (
          <p style={{ fontSize: '0.78rem', color: C.textLight, marginBottom: '0.75rem' }}>
            {insumo.especificaciones}
          </p>
        )}
        <p style={{ fontSize: '0.78rem', color: C.teal, marginBottom: '1rem' }}>
          Ambulancia: <strong>{insumo.ambulancia?.codigo || 'Sin asignar'}</strong>
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', minHeight: '180px',
          alignItems: 'center' }}>
          {cargando && <p style={{ color: C.textMid }}>Generando QR...</p>}
          {!cargando && qrUrl && (
            <img src={qrUrl} alt="QR" style={{
              width: '200px', height: '200px',
              border: `1px solid ${C.greenBorder}`, borderRadius: '8px',
            }} />
          )}
        </div>

        <p style={{ fontSize: '0.68rem', color: C.textLight, marginTop: '0.5rem' }}>
          Escanea para ver información del insumo
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
        <Btn variant="ghost" onClick={onClose}>Cerrar</Btn>
        <Btn variant="secondary" onClick={imprimir}>🖨 Imprimir</Btn>
        <Btn variant="primary" onClick={descargar} disabled={!qrUrl}>⬇ Descargar QR</Btn>
      </div>

      {/* CSS de impresión: visibility permite mostrar el card aunque el resto sea invisible */}
      <style>{`
        @media print {
          body { visibility: hidden; }
          #qr-card { visibility: visible; position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL BUSCAR POR CÓDIGO (escáner QR + manual)
══════════════════════════════════════════════════════════════════════════════ */
function ModalBuscar({ token, onClose, onEncontrado }) {
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const intervalRef = useRef(null);
  const [modo, setModo]         = useState('inicio'); // inicio | camera | manual | buscando | error
  const [codigo, setCodigo]     = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [soportaBarcode]        = useState(() => typeof window !== 'undefined' && 'BarcodeDetector' in window);

  useEffect(() => () => detenerCamera(), []);

  const detenerCamera = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  };

  const iniciarCamera = async () => {
    setModo('camera'); setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }

      if (soportaBarcode) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        intervalRef.current = setInterval(async () => {
          try {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) { detenerCamera(); buscar(barcodes[0].rawValue); }
          } catch {}
        }, 300);
      }
    } catch {
      setModo('error');
      setErrorMsg('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
    }
  };

  const buscar = async (val) => {
    if (!val?.trim()) { setErrorMsg('Ingresa un código'); return; }
    setModo('buscando');
    try {
      const res = await axios.get(`${API}/api/insumos/qr/${encodeURIComponent(val.trim().toUpperCase())}`, {
        headers: authHeader(token),
      });
      onEncontrado(res.data);
    } catch (err) {
      setModo('error');
      setErrorMsg(err.response?.status === 404
        ? 'No se encontró ningún insumo con ese código'
        : 'Error al consultar el código');
    }
  };

  return (
    <Modal onClose={() => { detenerCamera(); onClose(); }} width="480px">
      <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: C.textDark, marginBottom: '1rem' }}>
        Buscar insumo
      </h2>

      {modo === 'inicio' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: C.textMid, fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Escanea el QR del insumo o ingresa su código manualmente (ej: INS-COL-001)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
            {typeof navigator !== 'undefined' && navigator.mediaDevices && (
              <Btn variant="primary" onClick={iniciarCamera} size="md">📷 Abrir cámara</Btn>
            )}
            <Btn variant="secondary" onClick={() => setModo('manual')} size="md">⌨️ Ingresar código manual</Btn>
          </div>
        </div>
      )}

      {modo === 'camera' && (
        <div>
          <video ref={videoRef} playsInline muted style={{
            width: '100%', borderRadius: '8px', border: `2px solid ${C.green}`,
            backgroundColor: '#000', maxHeight: '320px', objectFit: 'cover',
          }} />
          <p style={{ fontSize: '0.78rem', color: C.textLight, marginTop: '0.75rem', textAlign: 'center' }}>
            Apunta la cámara al código QR del insumo
          </p>
          {!soportaBarcode && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.8rem', color: C.amber, marginBottom: '0.5rem' }}>
                Escaneo automático no disponible. Ingresa el código:
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="INS-COL-001" />
                <Btn variant="primary" onClick={() => buscar(codigo)}>Buscar</Btn>
              </div>
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
            <Btn variant="ghost" onClick={() => { detenerCamera(); setModo('manual'); }}>
              Ingresar código manualmente
            </Btn>
          </div>
        </div>
      )}

      {modo === 'manual' && (
        <div>
          <Campo label="Código del insumo" error={errorMsg}>
            <Input value={codigo} onChange={e => setCodigo(e.target.value)}
              placeholder="INS-COL-001" />
          </Campo>
          <p style={{ fontSize: '0.75rem', color: C.textLight, marginBottom: '1rem' }}>
            Formato: INS-FAM-### (ej: INS-COL-001, INS-VEN-042)
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setModo('inicio')}>Volver</Btn>
            <Btn variant="primary" onClick={() => buscar(codigo)}>Buscar insumo</Btn>
          </div>
        </div>
      )}

      {modo === 'buscando' && (
        <p style={{ textAlign: 'center', color: C.textMid, padding: '2rem' }}>Buscando insumo...</p>
      )}

      {modo === 'error' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: C.red, marginBottom: '1rem' }}>{errorMsg}</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Btn variant="ghost" onClick={() => { setModo('inicio'); setErrorMsg(''); }}>Volver</Btn>
            <Btn variant="secondary" onClick={() => { setModo('manual'); setErrorMsg(''); setCodigo(''); }}>
              Intentar con otro código
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ── Modal resultado de búsqueda ──────────────────────────────────────────── */
function ModalResultadoBusqueda({ insumo: ini, token, ambulancias, onClose, onRefresh }) {
  const [insumo, setInsumo]   = useState(ini);
  const [accion, setAccion]   = useState(null); // 'editar' | 'reasignar' | 'baja'

  const recargar = async () => {
    const res = await axios.get(`${API}/api/insumos/${insumo.id}`, { headers: authHeader(token) });
    setInsumo(res.data);
    onRefresh();
    setAccion(null);
  };

  if (accion === 'editar')
    return <ModalEditar insumo={insumo} token={token} ambulancias={ambulancias} onClose={() => setAccion(null)} onSaved={recargar} />;
  if (accion === 'reasignar')
    return <ModalReasignar insumo={insumo} token={token} ambulancias={ambulancias} onClose={() => setAccion(null)} onSaved={recargar} />;
  if (accion === 'baja')
    return <ModalBaja insumo={insumo} token={token} onClose={() => setAccion(null)} onSaved={recargar} />;

  return (
    <Modal onClose={onClose} width="460px">
      <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: C.textDark, marginBottom: '1rem' }}>
        Insumo encontrado
      </h2>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <p style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: C.green, fontWeight: '700', marginBottom: '0.25rem' }}>
            {insumo.codigo || `#${insumo.id}`}
          </p>
          <p style={{ fontSize: '1.1rem', fontWeight: '700', color: C.textDark, marginBottom: '0.25rem' }}>
            {insumo.nombre}
          </p>
          {insumo.familia && <p style={{ fontSize: '0.85rem', color: C.textMid }}>{insumo.familia}</p>}
          {insumo.especificaciones && (
            <p style={{ fontSize: '0.8rem', color: C.textLight, marginTop: '0.25rem' }}>{insumo.especificaciones}</p>
          )}
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <EstadoBadge estado={insumo.estado} />
            <span style={{ fontSize: '0.82rem', color: C.teal }}>
              {insumo.ambulancia?.codigo || 'Sin ambulancia'}
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: C.textLight, marginTop: '0.5rem' }}>
            Creado: {formatFecha(insumo.fecha_creacion || insumo.createdAt)}
          </p>
        </div>
      </div>
      {insumo.estado === 'activo' && (
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <Btn variant="ghost" size="sm" onClick={() => setAccion('editar')}>✏️ Editar</Btn>
          <Btn variant="secondary" size="sm" onClick={() => setAccion('reasignar')}>🚑 Reasignar</Btn>
          <Btn variant="danger" size="sm" onClick={() => setAccion('baja')}>Dar de baja</Btn>
        </div>
      )}
      <div style={{ marginTop: '1rem', textAlign: 'right' }}>
        <Btn variant="ghost" onClick={onClose}>Cerrar</Btn>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MODAL HISTORIAL DE BAJAS
══════════════════════════════════════════════════════════════════════════════ */
function ModalHistorialBajas({ token, onClose }) {
  const [bajas, setBajas]     = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/insumos/bajas`, { headers: authHeader(token) })
      .then(r => setBajas(r.data))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [token]);

  return (
    <Modal onClose={onClose} width="800px">
      <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: C.textDark, marginBottom: '1.5rem' }}>
        Historial de bajas
      </h2>

      {cargando && <p style={{ color: C.textMid, textAlign: 'center', padding: '2rem' }}>Cargando...</p>}

      {!cargando && bajas.length === 0 && (
        <p style={{ color: C.textLight, textAlign: 'center', padding: '2rem' }}>
          No hay insumos dados de baja aún.
        </p>
      )}

      {!cargando && bajas.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ backgroundColor: C.redLight, borderBottom: `2px solid ${C.redBorder}` }}>
                {['Código', 'Nombre', 'Familia', 'Ambulancia', 'Motivo', 'Foto', 'Fecha baja'].map(h => (
                  <th key={h} style={{ padding: '0.55rem 0.75rem', textAlign: 'left',
                    color: C.red, fontWeight: '700', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bajas.map((b, i) => (
                <tr key={b.id} style={{
                  backgroundColor: i % 2 === 0 ? '#fff' : '#fdf9f9',
                  borderBottom: `1px solid ${C.redBorder}`,
                }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', color: C.red }}>{b.codigo}</td>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600', color: C.textDark }}>{b.nombre}</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: C.textMid }}>{b.familia || '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: C.textMid }}>{b.ambulancia_codigo || '—'}</td>
                  <td style={{ padding: '0.5rem 0.75rem', color: C.textMid, maxWidth: '200px' }}>
                    <span title={b.motivo}>
                      {b.motivo.length > 60 ? b.motivo.slice(0, 60) + '…' : b.motivo}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {b.foto_ruta ? (
                      <a href={`${API}${b.foto_ruta}`} target="_blank" rel="noopener noreferrer"
                        style={{ color: C.teal, fontSize: '0.78rem', textDecoration: 'underline' }}>
                        Ver foto
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', color: C.textMid, whiteSpace: 'nowrap' }}>
                    {b.fecha_baja_fmt || formatFecha(b.fecha_baja)}
                  </td>
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

/* ══════════════════════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
══════════════════════════════════════════════════════════════════════════════ */
export default function InventarioPage() {
  const router = useRouter();
  const [usuario, setUsuario]       = useState(null);
  const [token, setToken]           = useState(null);
  const [insumos, setInsumos]       = useState([]);
  const [ambulancias, setAmbulancias] = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [errorGlobal, setErrorGlobal] = useState('');

  // Filtros
  const [busqueda, setBusqueda]       = useState('');
  const [filtroFamilia, setFiltroFamilia] = useState('');
  const [filtroAmb, setFiltroAmb]     = useState('');

  // Estado de modales
  const [modalCrear, setModalCrear]       = useState(false);
  const [insumoEditar, setInsumoEditar]   = useState(null);
  const [insumoQR, setInsumoQR]           = useState(null);
  const [insumoBaja, setInsumoBaja]       = useState(null);
  const [insumoReasignar, setInsumoReasignar] = useState(null);
  const [modalBuscar, setModalBuscar]     = useState(false);
  const [resultadoBusqueda, setResultadoBusqueda] = useState(null);
  const [modalHistorialBajas, setModalHistorialBajas] = useState(false);

  /* ── Auth ────────────────────────────────────────────────────────────────── */
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
      setUsuario(usr ? JSON.parse(usr) : { numero_ambulancia: decoded.numero_ambulancia, rol: decoded.rol });
    } catch {
      setUsuario({ numero_ambulancia: decoded.numero_ambulancia, rol: decoded.rol });
    }
  }, [router]);

  /* ── Cargar datos ────────────────────────────────────────────────────────── */
  const cargarInsumos = useCallback(async (tkn) => {
    if (!tkn) return;
    setCargando(true); setErrorGlobal('');
    try {
      const { data } = await axios.get(`${API}/api/insumos`, { headers: authHeader(tkn) });
      setInsumos(data);
    } catch {
      setErrorGlobal('No se pudo cargar el inventario. Verifica la conexión con el servidor.');
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarAmbulancias = useCallback(async (tkn) => {
    if (!tkn) return;
    try {
      const { data } = await axios.get(`${API}/api/ambulancias`, { headers: authHeader(tkn) });
      setAmbulancias(data);
    } catch {}
  }, []);

  useEffect(() => {
    if (token) { cargarInsumos(token); cargarAmbulancias(token); }
  }, [token, cargarInsumos, cargarAmbulancias]);

  const despuesDeAccion = () => {
    setModalCrear(false);
    setInsumoEditar(null);
    setInsumoBaja(null);
    setInsumoReasignar(null);
    cargarInsumos(token);
  };

  const cerrarSesion = () => {
    Cookies.remove('token'); Cookies.remove('usuario'); router.push('/login');
  };

  /* ── Filtrado ────────────────────────────────────────────────────────────── */
  const insumosFiltrados = insumos.filter(ins => {
    const q = busqueda.toLowerCase();
    const coincideBusqueda = !q ||
      ins.nombre?.toLowerCase().includes(q) ||
      ins.codigo?.toLowerCase().includes(q) ||
      ins.especificaciones?.toLowerCase().includes(q);
    const coincideFamilia = !filtroFamilia || ins.familia === filtroFamilia;
    const coincideAmb = !filtroAmb ||
      (filtroAmb === 'ninguna' ? !ins.ambulanciaId : String(ins.ambulanciaId) === filtroAmb);
    return coincideBusqueda && coincideFamilia && coincideAmb;
  });

  // Familias únicas presentes en el inventario
  const familiasPresentes = [...new Set(insumos.map(i => i.familia).filter(Boolean))].sort();

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

      <main style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── Encabezado ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: '700', color: C.textDark, marginBottom: '0.2rem' }}>
              Inventario de Insumos
            </h1>
            <p style={{ fontSize: '0.875rem', color: C.textMid }}>
              {insumosFiltrados.length} de {insumos.length} unidad{insumos.length !== 1 ? 'es' : ''} activa{insumos.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={() => setModalHistorialBajas(true)} size="md">
              📋 Historial bajas
            </Btn>
            <Btn variant="secondary" onClick={() => setModalBuscar(true)} size="md">
              🔍 Buscar por código
            </Btn>
            {usuario.rol === 'admin' && (
              <Btn variant="primary" onClick={() => setModalCrear(true)} size="md">
                + Nuevo insumo
              </Btn>
            )}
          </div>
        </div>

        {/* ── Barra de filtros ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem',
          backgroundColor: C.cardBg, borderRadius: '12px', padding: '1rem',
          boxShadow: C.cardShadow,
        }}>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, código o especificación..."
            style={{
              flex: '1', minWidth: '220px', padding: '0.55rem 0.9rem', borderRadius: '8px',
              border: `1px solid ${C.greenBorder}`, fontSize: '0.875rem',
              color: C.textDark, outline: 'none', backgroundColor: '#fff',
            }} />

          <select value={filtroFamilia} onChange={e => setFiltroFamilia(e.target.value)}
            style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: `1px solid ${C.greenBorder}`,
              fontSize: '0.875rem', color: C.textDark, backgroundColor: '#fff', cursor: 'pointer' }}>
            <option value="">Todas las familias</option>
            {familiasPresentes.map(f => <option key={f} value={f}>{f}</option>)}
          </select>

          <select value={filtroAmb} onChange={e => setFiltroAmb(e.target.value)}
            style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', border: `1px solid ${C.greenBorder}`,
              fontSize: '0.875rem', color: C.textDark, backgroundColor: '#fff', cursor: 'pointer' }}>
            <option value="">Todas las ambulancias</option>
            <option value="ninguna">Sin ambulancia</option>
            {ambulancias.map(a => <option key={a.id} value={a.id}>{a.codigo}</option>)}
          </select>

          {(busqueda || filtroFamilia || filtroAmb) && (
            <Btn variant="ghost" size="sm" onClick={() => { setBusqueda(''); setFiltroFamilia(''); setFiltroAmb(''); }}>
              ✕ Limpiar filtros
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

        {/* ── Tabla de insumos ─────────────────────────────────────────────── */}
        <div style={{ backgroundColor: C.cardBg, borderRadius: '14px',
          boxShadow: C.cardShadow, overflow: 'hidden' }}>

          {cargando ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: C.textMid }}>
              Cargando inventario...
            </div>
          ) : insumosFiltrados.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: C.textLight }}>
              {busqueda || filtroFamilia || filtroAmb
                ? 'No se encontraron insumos con esos filtros.'
                : 'No hay insumos activos registrados.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: C.greenLight, borderBottom: `2px solid ${C.greenBorder}` }}>
                    {['Código', 'Nombre', 'Familia', 'Especificaciones', 'Ambulancia', 'Estado', 'Creado', 'Modificado', 'Acciones'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left',
                        fontSize: '0.73rem', fontWeight: '700', color: C.textMid,
                        textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {insumosFiltrados.map((ins, i) => (
                    <tr key={ins.id}
                      style={{
                        backgroundColor: i % 2 === 0 ? '#fff' : '#fafcfb',
                        borderBottom: `1px solid ${C.greenBorder}`,
                        transition: 'background-color 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = C.greenLight}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#fff' : '#fafcfb'}
                    >
                      {/* Código */}
                      <td style={{ padding: '0.65rem 1rem', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem',
                          fontWeight: '700', color: C.green }}>
                          {ins.codigo || `#${ins.id}`}
                        </span>
                      </td>

                      {/* Nombre */}
                      <td style={{ padding: '0.65rem 1rem', fontWeight: '600', color: C.textDark,
                        maxWidth: '180px' }}>
                        {ins.nombre}
                      </td>

                      {/* Familia */}
                      <td style={{ padding: '0.65rem 1rem', color: C.textMid, whiteSpace: 'nowrap' }}>
                        {ins.familia ? (
                          <span style={{
                            backgroundColor: C.tealLight, color: C.teal,
                            border: `1px solid ${C.tealBorder}`,
                            borderRadius: '5px', padding: '0.15rem 0.45rem',
                            fontSize: '0.75rem', fontWeight: '600',
                          }}>{ins.familia_abrev || ins.familia}</span>
                        ) : '—'}
                      </td>

                      {/* Especificaciones */}
                      <td style={{ padding: '0.65rem 1rem', color: C.textLight,
                        fontSize: '0.8rem', maxWidth: '180px' }}>
                        {ins.especificaciones
                          ? <span title={ins.especificaciones}>
                              {ins.especificaciones.length > 40
                                ? ins.especificaciones.slice(0, 40) + '…'
                                : ins.especificaciones}
                            </span>
                          : '—'}
                      </td>

                      {/* Ambulancia */}
                      <td style={{ padding: '0.65rem 1rem', whiteSpace: 'nowrap' }}>
                        {ins.ambulancia ? (
                          <span style={{ fontSize: '0.82rem', fontWeight: '600', color: C.teal }}>
                            {ins.ambulancia.codigo}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: C.textLight }}>Sin asignar</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <EstadoBadge estado={ins.estado} />
                      </td>

                      {/* Fecha creación */}
                      <td style={{ padding: '0.65rem 1rem', color: C.textLight,
                        fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {formatFecha(ins.fecha_creacion || ins.createdAt)}
                      </td>

                      {/* Fecha modificación */}
                      <td style={{ padding: '0.65rem 1rem', color: C.textLight,
                        fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {formatFecha(ins.fecha_modificacion || ins.updatedAt)}
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: '0.65rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <Btn variant="ghost" size="xs" onClick={() => setInsumoQR(ins)}>
                            🔲 QR
                          </Btn>
                          {usuario.rol === 'admin' && ins.estado === 'activo' && (
                            <>
                              <Btn variant="ghost" size="xs" onClick={() => setInsumoEditar(ins)}>
                                ✏️
                              </Btn>
                              <Btn variant="secondary" size="xs" onClick={() => setInsumoReasignar(ins)}>
                                🚑
                              </Btn>
                              <Btn variant="danger" size="xs" onClick={() => setInsumoBaja(ins)}>
                                Baja
                              </Btn>
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

      {/* ── Modales ──────────────────────────────────────────────────────────── */}
      {modalCrear && (
        <ModalCrear token={token} ambulancias={ambulancias}
          onClose={() => setModalCrear(false)} onSaved={despuesDeAccion} />
      )}
      {insumoEditar && (
        <ModalEditar insumo={insumoEditar} token={token} ambulancias={ambulancias}
          onClose={() => setInsumoEditar(null)} onSaved={despuesDeAccion} />
      )}
      {insumoQR && (
        <ModalQR insumo={insumoQR} token={token} onClose={() => setInsumoQR(null)} />
      )}
      {insumoBaja && (
        <ModalBaja insumo={insumoBaja} token={token}
          onClose={() => setInsumoBaja(null)} onSaved={despuesDeAccion} />
      )}
      {insumoReasignar && (
        <ModalReasignar insumo={insumoReasignar} token={token} ambulancias={ambulancias}
          onClose={() => setInsumoReasignar(null)} onSaved={despuesDeAccion} />
      )}
      {modalBuscar && !resultadoBusqueda && (
        <ModalBuscar token={token}
          onClose={() => setModalBuscar(false)}
          onEncontrado={ins => { setModalBuscar(false); setResultadoBusqueda(ins); }} />
      )}
      {resultadoBusqueda && (
        <ModalResultadoBusqueda insumo={resultadoBusqueda} token={token} ambulancias={ambulancias}
          onClose={() => setResultadoBusqueda(null)}
          onRefresh={() => cargarInsumos(token)} />
      )}
      {modalHistorialBajas && (
        <ModalHistorialBajas token={token} onClose={() => setModalHistorialBajas(false)} />
      )}
    </div>
  );
}
