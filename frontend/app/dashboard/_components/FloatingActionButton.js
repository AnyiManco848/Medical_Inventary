'use client';

/**
 * Botón de acción principal de un listado (Nuevo insumo, Nuevo usuario…).
 * Siempre fijo abajo a la derecha, mismo tamaño y estilo en todas las pantallas.
 * La página que lo usa añade la clase `app-main--fab` a <main> para que no tape
 * el último contenido. Estilos en globals.css (.fab).
 */
export default function FloatingActionButton({ onClick, children, type = 'button', ...rest }) {
  return (
    <button type={type} onClick={onClick} className="fab" {...rest}>
      {children}
    </button>
  );
}
