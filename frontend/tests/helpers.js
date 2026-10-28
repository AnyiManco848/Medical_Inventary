// Utilidades compartidas por las pruebas del frontend.

// JWT con la forma real (cabecera.payload.firma) en base64url. Las páginas solo decodifican el
// payload para decidir qué mostrar; la firma la valida el backend, así que aquí no importa.
export function crearJWT(payload = {}) {
  const b64url = (obj) => {
    let texto = btoa(JSON.stringify(obj)).replaceAll('+', '-').replaceAll('/', '_');
    while (texto.endsWith('=')) texto = texto.slice(0, -1);
    return texto;
  };
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.firma`;
}

export const jwtAdmin = (extra = {}) =>
  crearJWT({ id: 1, numero_ambulancia: 'Administrador01', rol: 'admin', exp: Math.floor(Date.now() / 1000) + 3600, ...extra });

export const jwtAmbulancia = (extra = {}) =>
  crearJWT({ id: 2, numero_ambulancia: 'Ambulancia01', rol: 'ambulancia', exp: Math.floor(Date.now() / 1000) + 3600, ...extra });

// Simula Cookies.get(nombre) a partir de un objeto { token, usuario }
export function cookiesCon(Cookies, valores) {
  Cookies.get.mockImplementation((nombre) => valores[nombre]);
}

// Respuesta de axios.get según la URL: { '/api/insumos': [...], ... }. Lo no listado falla con 404.
export function rutasGet(axios, mapa) {
  axios.get.mockImplementation(async (url) => {
    const clave = Object.keys(mapa)
      .sort((a, b) => b.length - a.length)
      .find((k) => url.endsWith(k) || url.includes(`${k}?`));
    if (clave === undefined) {
      const err = new Error(`GET no simulado: ${url}`);
      err.response = { status: 404, data: { message: 'No encontrado' } };
      throw err;
    }
    const valor = mapa[clave];
    if (valor instanceof Error) throw valor;
    return { data: typeof valor === 'function' ? valor(url) : valor };
  });
}
