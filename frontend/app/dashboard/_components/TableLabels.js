'use client';

import { useEffect } from 'react';

/**
 * Copia el texto de cada <th> en el atributo data-label de las celdas de su
 * columna, para que en móvil (< 640px) las filas de `.table-scroll` se muestren
 * como tarjetas con "ETIQUETA: valor" (ver globals.css). No renderiza nada.
 * Un MutationObserver mantiene las etiquetas al paginar, filtrar o abrir modales.
 */
function etiquetar(raiz) {
  raiz.querySelectorAll('.table-scroll table').forEach((tabla) => {
    const cabeceras = Array.from(tabla.querySelectorAll('thead th')).map((th) => th.textContent.trim());
    if (!cabeceras.length) return;
    tabla.querySelectorAll('tbody tr').forEach((fila) => {
      Array.from(fila.children).forEach((celda, i) => {
        const etiqueta = cabeceras[i] || '';
        if (celda.dataset.label !== etiqueta) celda.dataset.label = etiqueta;
      });
    });
  });
}

export default function TableLabels() {
  useEffect(() => {
    let pendiente = 0;
    const programar = () => {
      cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(() => etiquetar(document));
    };
    programar();
    const obs = new MutationObserver(programar);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { obs.disconnect(); cancelAnimationFrame(pendiente); };
  }, []);
  return null;
}
