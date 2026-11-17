import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cjs, crearRes, cifrarParaLogin } from '../helpers.js';

const bcrypt = cjs('bcryptjs');
const jwt = cjs('jsonwebtoken');
const { Usuario } = cjs('../src/models');
const { login, clavePublica } = cjs('../src/controllers/auth.controller');
const { obtenerClavePublica, VIGENCIA_MS, MENSAJE_INVALIDA, MENSAJE_VENCIDA } = cjs('../src/config/loginRsa');

const PASSWORD = 'Clave123*';
// Costo 4 para que el hash sea rápido en pruebas (en producción se usa 12)
const HASH = bcrypt.hashSync(PASSWORD, 4);

function crearUsuarioFalso(extra = {}) {
  return {
    id: 1,
    nombre: 'Administrador 01',
    numero_ambulancia: 'Administrador01',
    password: HASH,
    activo: true,
    intentos_fallidos: 0,
    bloqueado_hasta: null,
    rol: { nombre: 'admin' },
    ambulancia: null,
    save: vi.fn().mockResolvedValue(undefined),
    ...extra,
  };
}

describe('auth.controller · login', () => {
  let res;
  let next;

  beforeEach(() => {
    res = crearRes();
    next = vi.fn();
  });

  it('400 si faltan usuario o contraseña', async () => {
    await login({ body: { numero_ambulancia: 'Administrador01' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuario y contraseña son requeridos' });

    const res2 = crearRes();
    await login({ body: { password: PASSWORD } }, res2, next);
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  it('404 si el usuario no existe', async () => {
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(null);

    await login({ body: { numero_ambulancia: 'NoExiste', password: PASSWORD } }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuario no registrado' });
  });

  it('busca el usuario con el identificador sin espacios sobrantes', async () => {
    const spy = vi.spyOn(Usuario, 'findOne').mockResolvedValue(null);

    await login({ body: { numero_ambulancia: '  Administrador01  ', password: PASSWORD } }, res, next);

    expect(spy.mock.calls[0][0].where).toEqual({ numero_ambulancia: 'Administrador01' });
  });

  it('403 si la cuenta está desactivada', async () => {
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(crearUsuarioFalso({ activo: false }));

    await login({ body: { numero_ambulancia: 'Administrador01', password: PASSWORD } }, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Cuenta desactivada. Contacte al administrador.',
    });
  });

  it('403 si la cuenta sigue bloqueada e informa los minutos restantes', async () => {
    const enDiezMin = new Date(Date.now() + 10 * 60 * 1000);
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(
      crearUsuarioFalso({ bloqueado_hasta: enDiezMin }),
    );

    await login({ body: { numero_ambulancia: 'Administrador01', password: PASSWORD } }, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    const cuerpo = res.json.mock.calls[0][0];
    expect(cuerpo.message).toMatch(/Cuenta bloqueada\. Intente en (9|10) minuto\(s\)\./);
    expect(cuerpo.bloqueado_hasta).toEqual(enDiezMin);
  });

  it('permite el ingreso si el bloqueo ya venció y lo limpia', async () => {
    const usuario = crearUsuarioFalso({
      bloqueado_hasta: new Date(Date.now() - 60 * 1000),
      intentos_fallidos: 2,
    });
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(usuario);

    await login({ body: { numero_ambulancia: 'Administrador01', password: PASSWORD } }, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(usuario.bloqueado_hasta).toBeNull();
    expect(usuario.intentos_fallidos).toBe(0);
  });

  it('401 con contraseña incorrecta: suma un intento e informa los restantes', async () => {
    const usuario = crearUsuarioFalso();
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(usuario);

    await login({ body: { numero_ambulancia: 'Administrador01', password: 'mala' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Contraseña incorrecta. Intentos restantes: 2',
    });
    expect(usuario.intentos_fallidos).toBe(1);
    expect(usuario.save).toHaveBeenCalledTimes(1);
  });

  it('al tercer intento fallido bloquea la cuenta 24 horas y reinicia el contador', async () => {
    const usuario = crearUsuarioFalso({ intentos_fallidos: 2 });
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(usuario);
    const antes = Date.now();

    await login({ body: { numero_ambulancia: 'Administrador01', password: 'mala' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].message).toBe(
      'Cuenta bloqueada por 24 horas debido a múltiples intentos fallidos.',
    );
    expect(usuario.intentos_fallidos).toBe(0);
    const horasBloqueo = (usuario.bloqueado_hasta.getTime() - antes) / 3_600_000;
    expect(horasBloqueo).toBeGreaterThan(23.9);
    expect(horasBloqueo).toBeLessThan(24.1);
    expect(usuario.save).toHaveBeenCalledTimes(1);
  });

  it('200 con credenciales válidas: devuelve token con id, usuario y rol', async () => {
    const usuario = crearUsuarioFalso({ intentos_fallidos: 1 });
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(usuario);

    await login({ body: { numero_ambulancia: 'Administrador01', password: PASSWORD } }, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const { token, usuario: datos } = res.json.mock.calls[0][0];

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    expect(payload).toMatchObject({ id: 1, numero_ambulancia: 'Administrador01', rol: 'admin' });

    expect(datos).toEqual({
      id: 1,
      nombre: 'Administrador 01',
      numero_ambulancia: 'Administrador01',
      rol: 'admin',
      ambulancia: null,
    });
    // Nunca debe viajar el hash de la contraseña
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain(HASH);
    expect(usuario.intentos_fallidos).toBe(0);
    expect(usuario.save).toHaveBeenCalled();
  });

  it('incluye los datos de la ambulancia asignada cuando existe', async () => {
    const usuario = crearUsuarioFalso({
      numero_ambulancia: 'Ambulancia01',
      rol: { nombre: 'ambulancia' },
      ambulancia: { id: 5, codigo: 'AMB-05', placa: 'ABC123' },
    });
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(usuario);

    await login({ body: { numero_ambulancia: 'Ambulancia01', password: PASSWORD } }, res, next);

    const { usuario: datos } = res.json.mock.calls[0][0];
    expect(datos.rol).toBe('ambulancia');
    expect(datos.ambulancia).toEqual({ id: 5, codigo: 'AMB-05', placa: 'ABC123' });
  });

  it('400 si el cuerpo no existe', async () => {
    await login({}, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuario y contraseña son requeridos' });
  });

  it('delega en next(error) si la base de datos falla', async () => {
    const error = new Error('DB caída');
    vi.spyOn(Usuario, 'findOne').mockRejectedValue(error);

    await login({ body: { numero_ambulancia: 'Administrador01', password: PASSWORD } }, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('auth.controller · contraseña cifrada (RSA-OAEP)', () => {
  let res;
  let next;
  const nodeEnvOriginal = process.env.NODE_ENV;

  beforeEach(() => {
    res = crearRes();
    next = vi.fn();
  });

  afterEach(() => {
    process.env.NODE_ENV = nodeEnvOriginal;
  });

  const cuerpoCifrado = (password, opciones) => ({
    numero_ambulancia: 'Administrador01',
    password_cifrada: cifrarParaLogin(password, opciones),
  });

  it('200 cuando password_cifrada se descifra y coincide con el hash', async () => {
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(crearUsuarioFalso());

    await login({ body: cuerpoCifrado(PASSWORD) }, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].token).toEqual(expect.any(String));
  });

  it('en producción también acepta la contraseña cifrada', async () => {
    process.env.NODE_ENV = 'production';
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(crearUsuarioFalso());

    await login({ body: cuerpoCifrado(PASSWORD) }, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('400 si el ts tiene más de 2 minutos y no consulta la base ni suma intentos', async () => {
    const spy = vi.spyOn(Usuario, 'findOne');

    await login({ body: cuerpoCifrado(PASSWORD, { ts: Date.now() - VIGENCIA_MS - 1000 }) }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: MENSAJE_VENCIDA });
    expect(spy).not.toHaveBeenCalled();
  });

  it('400 si password_cifrada no es base64 válido', async () => {
    const spy = vi.spyOn(Usuario, 'findOne');

    await login({ body: { numero_ambulancia: 'Administrador01', password_cifrada: '%%%no-base64%%%' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: MENSAJE_INVALIDA });
    expect(spy).not.toHaveBeenCalled();
  });

  it('en producción rechaza la contraseña en claro con 400', async () => {
    process.env.NODE_ENV = 'production';
    const spy = vi.spyOn(Usuario, 'findOne');

    await login({ body: { numero_ambulancia: 'Administrador01', password: PASSWORD } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'La contraseña debe enviarse cifrada.' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('en desarrollo acepta la contraseña en claro (compatibilidad)', async () => {
    process.env.NODE_ENV = 'development';
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(crearUsuarioFalso());

    await login({ body: { numero_ambulancia: 'Administrador01', password: PASSWORD } }, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('si llegan los dos campos se usa la cifrada', async () => {
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(crearUsuarioFalso());

    await login({
      body: { ...cuerpoCifrado(PASSWORD), password: 'otra-cosa' },
    }, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('el bloqueo sigue funcionando: 3 contraseñas cifradas incorrectas bloquean 24 horas', async () => {
    const usuario = crearUsuarioFalso();
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(usuario);

    const respuestas = [];
    for (let i = 0; i < 3; i++) {
      const r = crearRes();
      await login({ body: cuerpoCifrado('mala') }, r, next);
      respuestas.push(r);
    }

    expect(respuestas[0].status).toHaveBeenCalledWith(401);
    expect(respuestas[0].json).toHaveBeenCalledWith({ message: 'Contraseña incorrecta. Intentos restantes: 2' });
    expect(respuestas[1].json).toHaveBeenCalledWith({ message: 'Contraseña incorrecta. Intentos restantes: 1' });
    expect(respuestas[2].status).toHaveBeenCalledWith(403);
    expect(usuario.bloqueado_hasta).toBeInstanceOf(Date);

    // Con la cuenta bloqueada, ni la contraseña correcta deja entrar
    const r4 = crearRes();
    await login({ body: cuerpoCifrado(PASSWORD) }, r4, next);
    expect(r4.status).toHaveBeenCalledWith(403);
    expect(r4.json.mock.calls[0][0].message).toMatch(/^Cuenta bloqueada\. Intente en/);
  });

  it('no escribe en consola el cuerpo, la contraseña ni el texto descifrado', async () => {
    const espias = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(crearUsuarioFalso());

    await login({ body: cuerpoCifrado(PASSWORD) }, res, next);
    await login({ body: cuerpoCifrado('mala') }, crearRes(), next);
    await login({ body: { numero_ambulancia: 'x', password_cifrada: 'AAAA' } }, crearRes(), next);

    for (const espia of espias) expect(espia).not.toHaveBeenCalled();
  });
});

describe('auth.controller · clavePublica', () => {
  it('responde la clave pública SPKI en base64 con Cache-Control: no-store', () => {
    const res = crearRes();
    res.set = vi.fn(() => res);

    clavePublica({}, res);

    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.json).toHaveBeenCalledWith({ publicKey: obtenerClavePublica() });
  });
});
