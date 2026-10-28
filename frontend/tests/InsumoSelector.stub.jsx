// Reemplazo simple de InsumoSelector para las pruebas de las páginas que lo usan.
// El componente real tiene sus propias pruebas (InsumoSelector.test.jsx); aquí solo interesa
// que la página reaccione cuando se elige o se limpia un insumo.
export const INSUMO_PRUEBA = { id: 11, codigo: 'INS-COL-001', nombre: 'Collarín cervical' };
export const INSUMO_SIN_CODIGO = { id: 12, codigo: null, nombre: 'Insumo legacy' };

export default function InsumoSelectorFalso({ onInsumoSeleccionado, ambulanciaId }) {
  return (
    <div data-testid="insumo-selector" data-ambulancia={ambulanciaId ?? ''}>
      <button type="button" onClick={() => onInsumoSeleccionado(INSUMO_PRUEBA)}>elegir insumo</button>
      <button type="button" onClick={() => onInsumoSeleccionado(INSUMO_SIN_CODIGO)}>elegir insumo sin código</button>
      <button type="button" onClick={() => onInsumoSeleccionado(null)}>limpiar insumo</button>
    </div>
  );
}
