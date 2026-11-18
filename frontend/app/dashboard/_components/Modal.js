'use client';

import { useEffect } from 'react';

// Contador a nivel de módulo: con modales apilados, el scroll del body solo se
// libera al cerrar el último.
let modalesAbiertos = 0;
let overflowPrevio = '';

/**
 * Modal compartido.
 * - Móvil (< 640px): ocupa toda la pantalla (100dvh) con scroll interno.
 * - ≥ 640px: diálogo centrado de ancho `width` (máx. 100% - 2rem).
 * Los botones de acción se colocan con <ActionBar> como último hijo del form.
 */
export default function Modal({ children, onClose, width = '520px', labelledBy }) {
  useEffect(() => {
    if (modalesAbiertos === 0) {
      overflowPrevio = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    modalesAbiertos += 1;
    return () => {
      modalesAbiertos -= 1;
      if (modalesAbiertos === 0) document.body.style.overflow = overflowPrevio;
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={{ '--modal-w': width }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
