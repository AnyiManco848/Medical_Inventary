import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cjs, crearRes } from '../helpers.js';

const bcrypt = cjs('bcryptjs');
const { Usuario, Role, Ambulancia } = cjs('../src/models');
const { listar, crear, editar, desactivar } = cjs('../src/controllers/usuario.controller');

const cuerpoValido = {
  nombre: 'Ambulancia Uno',
  numero_ambulancia: 'Ambulancia01',
  password: 'Clave123*',
  roleId: 2,
};

describe('usuario.controller · listar', () => {
  it('lista usuarios excluyendo el campo password', async () => {
    const res = crearRes();
    const lista = [{ id: 1, nombre: 'A' }];
    const spy = vi.spyOn(Usuario, 'findAll').mockResolvedValue(lista);

    await listar({}, res, vi.fn());

    expect(spy.mock.calls[0][0].attributes).toEqual({ exclude: ['password'] });
    expect(res.json).toHaveBeenCalledWith(lista);
  });

  it('delega en next(error) si falla la consulta', async () => {
    const error = new Error('fallo');
    vi.spyOn(Usuario, 'findAll').mockRejectedValue(error);
    const next = vi.fn();

    await listar({}, crearRes(), next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('usuario.controller · crear', () => {
  let res;
  let next;

  beforeEach(() => {
    res = crearRes();
    next = vi.fn();
  });

  it.each([
    ['nombre', { nombre: '' }],
    ['numero_ambulancia', { numero_ambulancia: undefined }],
    ['password', { password: undefined }],
    ['roleId', { roleId: undefined }],
  ])('400 si falta %s', async (_campo, cambio) => {
    await crear({ body: { ...cuerpoValido, ...cambio } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/son requeridos/);
  });

  it('400 si el identificador son solo espacios', async () => {
    await crear({ body: { ...cuerpoValido, numero_ambulancia: '   ' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El número de ambulancia/usuario no puede estar vacío',
    });
  });

  it.each([
    ['menos de 8 caracteres', 'Ab1*'],
    ['sin número', 'Clave****abc'],
    ['sin símbolo', 'Clave12345'],
  ])('400 si la contraseña tiene %s', async (_motivo, password) => {
    await crear({ body: { ...cuerpoValido, password } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'La contraseña debe tener mínimo 8 caracteres, al menos un número y un símbolo',
    });
  });

  it('409 si el identificador ya está registrado', async () => {
    vi.spyOn(Usuario, 'findOne').mockResolvedValue({ id: 99 });

    await crear({ body: cuerpoValido }, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El número de ambulancia/usuario ya está registrado',
    });
  });

  it('400 si el rol no existe', async () => {
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(null);
    vi.spyOn(Role, 'findByPk').mockResolvedValue(null);

    await crear({ body: cuerpoValido }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El rol especificado no existe' });
  });

  it('201: guarda la contraseña cifrada y no la devuelve en la respuesta', async () => {
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(null);
    vi.spyOn(Role, 'findByPk').mockResolvedValue({ id: 2, nombre: 'ambulancia' });
    const createSpy = vi.spyOn(Usuario, 'create').mockImplementation(async (datos) => ({
      toJSON: () => ({ id: 10, ...datos }),
    }));

    await crear({ body: { ...cuerpoValido, numero_ambulancia: '  Ambulancia01 ' } }, res, next);

    const guardado = createSpy.mock.calls[0][0];
    expect(guardado.numero_ambulancia).toBe('Ambulancia01');
    expect(guardado.password).not.toBe(cuerpoValido.password);
    expect(bcrypt.compareSync(cuerpoValido.password, guardado.password)).toBe(true);
    expect(guardado.activo).toBe(true);

    expect(res.status).toHaveBeenCalledWith(201);
    const respuesta = res.json.mock.calls[0][0];
    expect(respuesta).not.toHaveProperty('password');
    expect(respuesta).toMatchObject({ id: 10, nombre: 'Ambulancia Uno', numero_ambulancia: 'Ambulancia01' });
  });
});

describe('usuario.controller · editar', () => {
  let res;
  let next;

  const crearUsuarioEditable = (extra = {}) => ({
    id: 3,
    nombre: 'Viejo',
    numero_ambulancia: 'Viejo01',
    roleId: 2,
    ambulanciaId: 4,
    password: 'hash-viejo',
    rol: { nombre: 'ambulancia' },
    save: vi.fn().mockResolvedValue(undefined),
    toJSON() {
      return {
        id: this.id,
        nombre: this.nombre,
        numero_ambulancia: this.numero_ambulancia,
        ambulanciaId: this.ambulanciaId,
        password: this.password,
      };
    },
    ...extra,
  });

  beforeEach(() => {
    res = crearRes();
    next = vi.fn();
  });

  it('404 si el usuario no existe', async () => {
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(null);

    await editar({ params: { id: '99' }, body: {} }, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuario no encontrado' });
  });

  it('409 si el nuevo identificador pertenece a otro usuario', async () => {
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(crearUsuarioEditable());
    vi.spyOn(Usuario, 'findOne').mockResolvedValue({ id: 77 });

    await editar({ params: { id: '3' }, body: { numero_ambulancia: 'Ocupado01' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El número de ambulancia/usuario ya está en uso por otro usuario',
    });
  });

  it('permite conservar el mismo identificador (la coincidencia es el propio usuario)', async () => {
    const usuario = crearUsuarioEditable();
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(usuario);
    vi.spyOn(Usuario, 'findOne').mockResolvedValue({ id: 3 });

    await editar({ params: { id: '3' }, body: { numero_ambulancia: 'Viejo01' } }, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(usuario.numero_ambulancia).toBe('Viejo01');
    expect(usuario.save).toHaveBeenCalledTimes(1);
    expect(res.json.mock.calls[0][0]).toMatchObject({ id: 3, numero_ambulancia: 'Viejo01' });
  });

  it('400 si el identificador nuevo está vacío', async () => {
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(crearUsuarioEditable());

    await editar({ params: { id: '3' }, body: { numero_ambulancia: '  ' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'El número de ambulancia/usuario no puede estar vacío',
    });
  });

  it('400 si el rol indicado no existe', async () => {
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(crearUsuarioEditable());
    vi.spyOn(Role, 'findByPk').mockResolvedValue(null);

    await editar({ params: { id: '3' }, body: { roleId: 999 } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'El rol especificado no existe' });
  });

  it('un usuario que pasa a rol admin queda sin ambulancia', async () => {
    const usuario = crearUsuarioEditable();
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(usuario);
    vi.spyOn(Role, 'findByPk').mockResolvedValue({ id: 1, nombre: 'admin' });

    await editar({ params: { id: '3' }, body: { roleId: 1 } }, res, next);

    expect(usuario.roleId).toBe(1);
    expect(usuario.ambulanciaId).toBeNull();
    expect(usuario.save).toHaveBeenCalledTimes(1);
  });

  it('400 si la ambulancia asignada no existe o está inactiva', async () => {
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(crearUsuarioEditable());
    vi.spyOn(Ambulancia, 'findOne').mockResolvedValue(null);

    await editar({ params: { id: '3' }, body: { ambulanciaId: 55 } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'La ambulancia especificada no existe o está inactiva',
    });
  });

  it('asigna una ambulancia activa a un usuario de rol ambulancia', async () => {
    const usuario = crearUsuarioEditable({ ambulanciaId: null });
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(usuario);
    const spy = vi.spyOn(Ambulancia, 'findOne').mockResolvedValue({ id: 8 });

    await editar({ params: { id: '3' }, body: { ambulanciaId: 8 } }, res, next);

    expect(spy.mock.calls[0][0].where).toEqual({ id: 8, activa: true });
    expect(usuario.ambulanciaId).toBe(8);
  });

  it('400 si la nueva contraseña es débil', async () => {
    const usuario = crearUsuarioEditable();
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(usuario);

    await editar({ params: { id: '3' }, body: { password: 'corta' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(usuario.save).not.toHaveBeenCalled();
  });

  it('cifra la nueva contraseña y no la devuelve', async () => {
    const usuario = crearUsuarioEditable();
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(usuario);

    await editar({ params: { id: '3' }, body: { password: 'NuevaClave1*' } }, res, next);

    expect(bcrypt.compareSync('NuevaClave1*', usuario.password)).toBe(true);
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('password');
  });
});

describe('usuario.controller · desactivar', () => {
  it('404 si el usuario no existe', async () => {
    const res = crearRes();
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(null);

    await desactivar({ params: { id: '1' } }, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Usuario no encontrado' });
  });

  it('marca el usuario como inactivo (borrado lógico)', async () => {
    const res = crearRes();
    const usuario = { id: 5, activo: true, save: vi.fn().mockResolvedValue(undefined) };
    vi.spyOn(Usuario, 'findByPk').mockResolvedValue(usuario);

    await desactivar({ params: { id: '5' } }, res, vi.fn());

    expect(usuario.activo).toBe(false);
    expect(usuario.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Usuario desactivado correctamente',
      id: 5,
    });
  });
});
