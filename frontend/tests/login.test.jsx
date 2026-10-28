import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import Cookies from 'js-cookie';

const push = vi.fn();
// Mismo objeto en cada render, como el router real (las páginas lo usan en dependencias de useEffect)
const router = { push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('axios', () => ({ default: { post: vi.fn() } }));
vi.mock('js-cookie', () => ({ default: { set: vi.fn() } }));

import LoginPage from '../app/login/page';

const campoUsuario = () => screen.getByPlaceholderText('Ej: Ambulancia01 o Administrador01');
const campoPassword = () => screen.getByPlaceholderText('••••••••');
const botonEntrar = () => screen.getByRole('button', { name: /iniciar sesión|iniciando sesión/i });

async function llenarYEnviar(user, usuario, password) {
  await user.type(campoUsuario(), usuario);
  await user.type(campoPassword(), password);
  await user.click(botonEntrar());
}

beforeEach(() => {
  push.mockReset();
});

describe('login/page.js', () => {
  it('muestra el formulario con usuario, contraseña oculta y botón', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(campoUsuario()).toHaveValue('');
    expect(campoPassword()).toHaveAttribute('type', 'password');
    expect(botonEntrar()).toBeEnabled();
  });

  it('un usuario de solo espacios muestra error y no llama a la API', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await llenarYEnviar(user, '   ', 'Clave123*');

    expect(screen.getByText('El usuario no puede estar vacío.')).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('login correcto: envía usuario sin espacios, guarda token y usuario en cookies y redirige', async () => {
    const usuario = { id: 1, nombre: 'Admin', rol: 'admin' };
    axios.post.mockResolvedValue({ data: { token: 'jwt-falso', usuario } });
    const user = userEvent.setup();
    render(<LoginPage />);

    await llenarYEnviar(user, '  Administrador01 ', 'Clave123*');

    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(axios.post).toHaveBeenCalledWith('http://localhost:4000/api/auth/login', {
      numero_ambulancia: 'Administrador01',
      password: 'Clave123*',
    });
    const opciones = { expires: 1 / 3, sameSite: 'strict' };
    expect(Cookies.set).toHaveBeenCalledWith('token', 'jwt-falso', opciones);
    expect(Cookies.set).toHaveBeenCalledWith('usuario', JSON.stringify(usuario), opciones);
  });

  it('mientras espera la respuesta desactiva el botón y muestra "Iniciando sesión..."', async () => {
    let responder;
    axios.post.mockReturnValue(new Promise((r) => { responder = r; }));
    const user = userEvent.setup();
    render(<LoginPage />);

    await llenarYEnviar(user, 'Ambulancia01', 'Clave123*');

    expect(botonEntrar()).toBeDisabled();
    expect(botonEntrar()).toHaveTextContent('Iniciando sesión...');

    responder({ data: { token: 't', usuario: {} } });
    await waitFor(() => expect(botonEntrar()).toBeEnabled());
    expect(botonEntrar()).toHaveTextContent('Iniciar sesión');
  });

  it('muestra el mensaje del servidor si las credenciales son incorrectas', async () => {
    axios.post.mockRejectedValue({ response: { data: { message: 'Credenciales inválidas' } } });
    const user = userEvent.setup();
    render(<LoginPage />);

    await llenarYEnviar(user, 'Ambulancia01', 'mala');

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument();
    expect(Cookies.set).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('sin respuesta del servidor muestra un mensaje genérico', async () => {
    axios.post.mockRejectedValue(new Error('Network Error'));
    const user = userEvent.setup();
    render(<LoginPage />);

    await llenarYEnviar(user, 'Ambulancia01', 'Clave123*');

    expect(await screen.findByText('Error al iniciar sesión. Intente nuevamente.')).toBeInTheDocument();
  });

  it('el botón del ojo muestra y oculta la contraseña', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(campoPassword()).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(campoPassword()).toHaveAttribute('type', 'password');
  });

  it('resalta el campo con foco y lo restaura al salir', () => {
    render(<LoginPage />);
    const campo = campoUsuario();

    fireEvent.focus(campo);
    expect(campo.style.boxShadow).toBe('0 0 0 3px rgba(45,134,83,0.15)');

    fireEvent.blur(campo);
    expect(campo.style.boxShadow).toBe('none');
  });

  it('el botón cambia de color al pasar el mouse, pero no mientras carga', async () => {
    axios.post.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<LoginPage />);
    const boton = botonEntrar();

    fireEvent.mouseEnter(boton);
    expect(boton.style.backgroundColor).toBe('rgb(74, 158, 110)');
    fireEvent.mouseLeave(boton);
    expect(boton.style.backgroundColor).toBe('rgb(45, 134, 83)');

    await llenarYEnviar(user, 'Ambulancia01', 'Clave123*');
    const colorCargando = boton.style.backgroundColor;
    fireEvent.mouseEnter(boton);
    fireEvent.mouseLeave(boton);
    expect(boton.style.backgroundColor).toBe(colorCargando);
  });

  it('dibuja el fondo ECG en el canvas y quita el listener de resize al desmontar', () => {
    const quitar = vi.spyOn(window, 'removeEventListener');
    const { container, unmount } = render(<LoginPage />);
    const canvas = container.querySelector('canvas');

    expect(canvas.width).toBe(window.innerWidth);
    expect(canvas.getContext('2d').stroke).toHaveBeenCalled();

    window.innerWidth = 500;
    fireEvent(window, new Event('resize'));
    expect(canvas.width).toBe(500);

    unmount();
    expect(quitar).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});

describe('login/page.js · accesibilidad', () => {
  it('cada label está asociado a su campo', () => {
    render(<LoginPage />);

    expect(screen.getByLabelText('Usuario')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('autocomplete', 'current-password');
  });
});
