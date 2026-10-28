// Fecha y hora actuales del navegador para los formularios (entregar, recoger, daño).
// Se usan los componentes LOCALES de Date: toISOString() da la fecha en UTC y, en Colombia (UTC-5),
// desde las 19:00 devolvía la fecha del día siguiente.
const dosDigitos = (n) => String(n).padStart(2, '0');

// AAAA-MM-DD, el formato de <input type="date">
export const getHoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
};

// HH:MM, el formato de <input type="time">
export const getHoraActual = () => {
  const d = new Date();
  return `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
};
