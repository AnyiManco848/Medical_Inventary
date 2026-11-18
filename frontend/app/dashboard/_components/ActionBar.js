'use client';

/**
 * Barra de acciones fija (Guardar / Cancelar / Registrar…).
 *
 * Usar como último hijo de un <form> dentro de una tarjeta (`.form-card`) o de
 * un <Modal>. Queda `sticky bottom-0` con fondo sólido, borde superior y sombra,
 * y respeta el safe-area inferior de iPhone. Estilos en globals.css (.action-bar).
 */
export default function ActionBar({ children, align = 'end', className = '', style }) {
  const cls = ['action-bar', align === 'start' ? 'action-bar--start' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}
