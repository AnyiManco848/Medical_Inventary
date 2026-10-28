import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtAdmin, jwtAmbulancia, cookiesCon, rutasGet } from './helpers.js';

const push = vi.fn();
const router = { push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('js-cookie', () => ({ default: { get: vi.fn(), remove: vi.fn() } }));

import UsuariosPage from '../app/dashboard/usuarios/page';

const usuario = (id, extra = {}) => ({
  id, nombre: `Usuario ${id}`, numero_ambulancia: `Amb${id}`, activo: true, rol: { id: 2, nombre: 'ambulancia' }, ...extra,
});
const USUARIOS = [
  usuario(1, { nombre: 'Ana Admin', numero_ambulancia: 'Administrador01', rol: { id: 1, nombre: 'admin' } }),
  usuario(2, { ambulancia: { id: 5 } }),
  usuario(3, { activo: false, numero_ambulancia: null, rol: null }),
];
const AMBULANCIAS = [{ id: 5, codigo: 'AMB-05', placa: 'ABC123' }, { id: 6, codigo: 'AMB-06', placa: null }];

let token;
const modal = () => screen.getByRole('heading', { level: 2 }).closest('div');
const campoModal = (name) => modal().querySelector(`[name="${name}"]`);

async function montar(usuarios = USUARIOS, ambulancias = AMBULANCIAS) {
  token = jwtAdmin();
  cookiesCon(Cookies, { token });
  rutasGet(axios, { '/api/usuarios': usuarios, '/api/ambulancias': ambulancias });
  const r = render(<UsuariosPage />);
  if (usuarios.length) await screen.findByText(usuarios[0].nombre);
  return r;
}

beforeEach(() => {
  push.mockReset();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('usuarios/page.js · acceso y listado', () => {
  it('sin token va al login', () => {
    cookiesCon(Cookies, {});
    rutasGet(axios, { '/api/usuarios': [] });

    render(<UsuariosPage />);

    expect(push).toHaveBeenCalledWith('/login');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('un token vencido borra las cookies, va al login y no pide la lista', () => {
    cookiesCon(Cookies, { token: jwtAdmin({ exp: Math.floor(Date.now() / 1000) - 10 }) });
    rutasGet(axios, { '/api/usuarios': [] });

    render(<UsuariosPage />);

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(Cookies.remove).toHaveBeenCalledWith('usuario');
    expect(push).toHaveBeenCalledWith('/login');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it.each([['rol ambulancia', jwtAmbulancia()], ['token ilegible', 'abc']])('con %s va al dashboard sin pedir la lista de usuarios', async (_c, t) => {
    cookiesCon(Cookies, { token: t });
    rutasGet(axios, { '/api/usuarios': [] });

    render(<UsuariosPage />);

    expect(push).toHaveBeenCalledWith('/dashboard');
    await new Promise((r) => setTimeout(r, 0));
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('lista los usuarios con rol, estado y acciones', async () => {
    await montar();

    expect(axios.get).toHaveBeenCalledWith('http://localhost:4000/api/usuarios', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(screen.getByText('3 usuario(s) registrados')).toBeInTheDocument();
    const [, fAdmin, fAmb, fInactivo] = screen.getAllByRole('row');
    expect(within(fAdmin).getByText('admin')).toBeInTheDocument();
    expect(within(fAmb).getByText('Activo')).toBeInTheDocument();
    expect(within(fInactivo).getByText('Inactivo')).toBeInTheDocument();
    expect(within(fInactivo).getAllByText('—')).toHaveLength(2);
    // Un usuario inactivo no tiene botón Desactivar
    expect(within(fInactivo).queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
    expect(within(fAmb).getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();

    fireEvent.mouseEnter(fAmb);
    expect(fAmb.style.backgroundColor).toBe('rgb(247, 251, 248)');
    fireEvent.mouseLeave(fAmb);
    expect(fAmb.style.backgroundColor).toBe('transparent');
  });

  it('muestra 5 y "Ver más" carga de a 5 con el conteo restante', async () => {
    const muchos = Array.from({ length: 11 }, (_, i) => usuario(i + 1));
    await montar(muchos);

    expect(screen.getAllByRole('row')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (6 restantes)' }));
    expect(screen.getAllByRole('row')).toHaveLength(11);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (1 restante)' }));
    expect(screen.getAllByRole('row')).toHaveLength(12);
    expect(screen.queryByRole('button', { name: /Ver más/ })).not.toBeInTheDocument();
  });

  it('sin usuarios muestra el estado vacío', async () => {
    await montar([]);

    expect(await screen.findByText('No hay usuarios registrados')).toBeInTheDocument();
  });

  it.each([
    [{ response: { data: { message: 'Token inválido' } } }, 'Token inválido'],
    [new Error('red'), 'Error al cargar usuarios'],
  ])('si falla la carga muestra el error (%#)', async (fallo, mensaje) => {
    cookiesCon(Cookies, { token: jwtAdmin() });
    axios.get.mockRejectedValue(fallo);

    render(<UsuariosPage />);

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
  });

  it('Cerrar sesión borra las cookies y va al login; los botones reaccionan al hover', async () => {
    await montar();
    const salir = screen.getByRole('button', { name: 'Cerrar sesión' });
    const nuevo = screen.getByRole('button', { name: '+ Nuevo usuario' });
    fireEvent.mouseEnter(salir); expect(salir.style.backgroundColor).toBe('rgb(252, 228, 225)');
    fireEvent.mouseLeave(salir); expect(salir.style.backgroundColor).toBe('rgb(253, 240, 239)');
    fireEvent.mouseEnter(nuevo); expect(nuevo.style.backgroundColor).toBe('rgb(74, 158, 110)');
    fireEvent.mouseLeave(nuevo); expect(nuevo.style.backgroundColor).toBe('rgb(45, 134, 83)');

    fireEvent.click(salir);

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(Cookies.remove).toHaveBeenCalledWith('usuario');
    expect(push).toHaveBeenCalledWith('/login');
  });
});

describe('usuarios/page.js · desactivar', () => {
  it('pide confirmación, llama a DELETE y recarga la lista', async () => {
    axios.delete.mockResolvedValue({ data: {} });
    await montar();
    const llamadasAntes = axios.get.mock.calls.length;

    fireEvent.click(screen.getAllByRole('button', { name: 'Desactivar' })[1]);

    expect(window.confirm).toHaveBeenCalledWith('¿Desactivar este usuario?');
    await waitFor(() => expect(axios.get.mock.calls.length).toBeGreaterThan(llamadasAntes));
    expect(axios.delete).toHaveBeenCalledWith('http://localhost:4000/api/usuarios/2', {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  it('si se cancela la confirmación no hace nada', async () => {
    window.confirm.mockReturnValue(false);
    await montar();

    fireEvent.click(screen.getAllByRole('button', { name: 'Desactivar' })[0]);

    expect(axios.delete).not.toHaveBeenCalled();
  });

  it.each([
    [{ response: { data: { message: 'Usuario no encontrado' } } }, 'Usuario no encontrado'],
    [new Error('red'), 'Error al desactivar usuario'],
  ])('si falla avisa con alert (%#)', async (fallo, mensaje) => {
    axios.delete.mockRejectedValue(fallo);
    await montar();

    fireEvent.click(screen.getAllByRole('button', { name: 'Desactivar' })[0]);

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(mensaje));
  });
});

describe('usuarios/page.js · modal crear / editar', () => {
  it('crear un admin: envía POST con ambulanciaId null y recarga', async () => {
    axios.post.mockResolvedValue({ data: {} });
    await montar();
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo usuario' }));
    expect(screen.getByRole('heading', { name: 'Nuevo usuario' })).toBeInTheDocument();
    // En un usuario nuevo no hay casilla "activo" y el rol por defecto es admin (sin ambulancia)
    expect(campoModal('activo')).toBeNull();
    expect(campoModal('ambulanciaId')).toBeNull();
    expect(campoModal('password')).toBeRequired();

    fireEvent.change(campoModal('nombre'), { target: { name: 'nombre', value: 'Nuevo Admin' } });
    fireEvent.change(campoModal('numero_ambulancia'), { target: { name: 'numero_ambulancia', value: 'Admin02' } });
    fireEvent.change(campoModal('password'), { target: { name: 'password', value: 'Clave123*' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Nuevo usuario' })).not.toBeInTheDocument());
    expect(axios.post).toHaveBeenCalledWith('http://localhost:4000/api/usuarios', {
      nombre: 'Nuevo Admin', numero_ambulancia: 'Admin02', password: 'Clave123*', roleId: 1, activo: true, ambulanciaId: null,
    }, { headers: { Authorization: `Bearer ${token}` } });
  });

  it('crear un usuario ambulancia: muestra las ambulancias y envía la elegida', async () => {
    axios.post.mockResolvedValue({ data: {} });
    await montar();
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo usuario' }));
    fireEvent.change(campoModal('roleId'), { target: { name: 'roleId', value: '2' } });

    expect(await screen.findByRole('option', { name: 'AMB-05 · ABC123' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'AMB-06' })).toBeInTheDocument();
    fireEvent.change(campoModal('ambulanciaId'), { target: { name: 'ambulanciaId', value: '6' } });
    fireEvent.change(campoModal('nombre'), { target: { name: 'nombre', value: 'Tripulación' } });
    fireEvent.change(campoModal('numero_ambulancia'), { target: { name: 'numero_ambulancia', value: 'Amb06' } });
    fireEvent.change(campoModal('password'), { target: { name: 'password', value: 'Clave123*' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(axios.post.mock.calls[0][1]).toMatchObject({ roleId: 2, ambulanciaId: 6 });
  });

  it('sin ambulancias disponibles lo indica y envía ambulanciaId null', async () => {
    axios.post.mockResolvedValue({ data: {} });
    cookiesCon(Cookies, { token: jwtAdmin() });
    rutasGet(axios, { '/api/usuarios': USUARIOS, '/api/ambulancias': new Error('red') });
    render(<UsuariosPage />);
    await screen.findByText('Ana Admin');
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo usuario' }));
    fireEvent.change(campoModal('roleId'), { target: { name: 'roleId', value: '2' } });

    expect(await screen.findByText('No hay ambulancias activas registradas.')).toBeInTheDocument();
    fireEvent.change(campoModal('nombre'), { target: { name: 'nombre', value: 'X' } });
    fireEvent.change(campoModal('numero_ambulancia'), { target: { name: 'numero_ambulancia', value: 'X1' } });
    fireEvent.change(campoModal('password'), { target: { name: 'password', value: 'Clave123*' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(axios.post.mock.calls[0][1].ambulanciaId).toBeNull();
  });

  it('editar: precarga datos, no envía password vacío y usa PUT', async () => {
    axios.put.mockResolvedValue({ data: {} });
    await montar();
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1]);

    expect(screen.getByRole('heading', { name: 'Editar: Usuario 2' })).toBeInTheDocument();
    expect(screen.getByText('(dejar vacío para no cambiar)')).toBeInTheDocument();
    expect(campoModal('nombre')).toHaveValue('Usuario 2');
    expect(campoModal('roleId')).toHaveValue('2');
    expect(await screen.findByRole('option', { name: 'AMB-05 · ABC123' })).toBeInTheDocument();
    expect(campoModal('ambulanciaId')).toHaveValue('5');
    fireEvent.click(campoModal('activo'));
    expect(campoModal('activo')).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    const [url, cuerpo] = axios.put.mock.calls[0];
    expect(url).toBe('http://localhost:4000/api/usuarios/2');
    expect(cuerpo).not.toHaveProperty('password');
    expect(cuerpo).toMatchObject({ nombre: 'Usuario 2', roleId: 2, activo: false, ambulanciaId: 5 });
  });

  it('editar con contraseña nueva la envía', async () => {
    axios.put.mockResolvedValue({ data: {} });
    await montar();
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    fireEvent.change(campoModal('password'), { target: { name: 'password', value: 'Nueva123*' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(axios.put).toHaveBeenCalled());
    expect(axios.put.mock.calls[0][1]).toMatchObject({ password: 'Nueva123*', roleId: 1, ambulanciaId: null });
  });

  it('editar un usuario sin rol cargado usa roleId y ambulanciaId planos', async () => {
    axios.put.mockResolvedValue({ data: {} });
    await montar([usuario(9, { rol: undefined, roleId: 2, ambulanciaId: 6, activo: undefined })]);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    expect(campoModal('roleId')).toHaveValue('2');
    expect(campoModal('activo')).toBeChecked();
    await screen.findByRole('option', { name: 'AMB-06' });
    expect(campoModal('ambulanciaId')).toHaveValue('6');
  });

  it.each([
    [{ response: { data: { message: 'La contraseña debe tener mínimo 8 caracteres' } } }, 'La contraseña debe tener mínimo 8 caracteres'],
    [new Error('red'), 'Error al guardar usuario'],
  ])('si el servidor rechaza, el modal sigue abierto con el error (%#)', async (fallo, mensaje) => {
    axios.put.mockRejectedValue(fallo);
    await montar();
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(mensaje)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Editar: Ana Admin' })).toBeInTheDocument();
  });

  it('mientras guarda muestra "Guardando..."; Cancelar cierra el modal', async () => {
    axios.put.mockReturnValue(new Promise(() => {}));
    await montar();
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('button', { name: 'Guardando...' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });

  it('el ojo muestra/oculta la contraseña y los campos se resaltan con foco', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo usuario' }));

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(campoModal('password')).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(campoModal('password')).toHaveAttribute('type', 'password');

    fireEvent.focus(campoModal('nombre'));
    expect(campoModal('nombre').style.boxShadow).toBe('0 0 0 3px rgba(45,134,83,0.15)');
    fireEvent.blur(campoModal('nombre'));
    expect(campoModal('nombre').style.boxShadow).toBe('none');
  });
});

describe('usuarios/page.js · accesibilidad', () => {
  it('los labels del formulario están asociados a sus campos', async () => {
    await montar();
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo usuario' }));

    expect(screen.getByLabelText('Nombre')).toHaveAttribute('name', 'nombre');
    expect(screen.getByLabelText('Número de Ambulancia / Usuario')).toHaveAttribute('name', 'numero_ambulancia');
    expect(screen.getByLabelText(/^Contraseña/)).toHaveAttribute('name', 'password');
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: '2' } });
    expect(screen.getByLabelText('Ambulancia asignada (FK inventario)')).toHaveAttribute('name', 'ambulanciaId');
  });
});
