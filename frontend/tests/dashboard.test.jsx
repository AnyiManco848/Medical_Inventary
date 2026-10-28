import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Cookies from 'js-cookie';
import { crearJWT, jwtAdmin, jwtAmbulancia, cookiesCon } from './helpers.js';

const push = vi.fn();
// Mismo objeto en cada render, como el router real (las páginas lo usan en dependencias de useEffect)
const router = { push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock('js-cookie', () => ({ default: { get: vi.fn(), remove: vi.fn() } }));

import DashboardPage from '../app/dashboard/page';

const enlaces = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'));

beforeEach(() => {
  push.mockReset();
});

describe('dashboard/page.js · sesión', () => {
  it('sin token redirige al login', () => {
    cookiesCon(Cookies, {});

    render(<DashboardPage />);

    expect(push).toHaveBeenCalledWith('/login');
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it.each([
    ['un token que no es JWT', 'no-es-un-jwt'],
    ['un token vencido', crearJWT({ id: 1, rol: 'admin', exp: Math.floor(Date.now() / 1000) - 60 })],
  ])('con %s borra las cookies y redirige al login', (_caso, token) => {
    cookiesCon(Cookies, { token });

    render(<DashboardPage />);

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(Cookies.remove).toHaveBeenCalledWith('usuario');
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('usa el nombre guardado en la cookie "usuario"', () => {
    cookiesCon(Cookies, { token: jwtAdmin(), usuario: JSON.stringify({ nombre: 'Ana Admin', rol: 'admin' }) });

    render(<DashboardPage />);

    expect(screen.getByRole('heading', { name: 'Bienvenido, Ana Admin' })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it.each([
    ['no existe', undefined],
    ['está corrupta', '{no-es-json'],
  ])('si la cookie "usuario" %s usa los datos del token', (_caso, usuario) => {
    cookiesCon(Cookies, { token: jwtAmbulancia(), usuario });

    render(<DashboardPage />);

    expect(screen.getByRole('heading', { name: 'Bienvenido, Ambulancia01' })).toBeInTheDocument();
  });

  it('un token sin fecha de vencimiento se acepta', () => {
    cookiesCon(Cookies, { token: crearJWT({ id: 5, numero_ambulancia: 'Ambulancia05', rol: 'ambulancia' }) });

    render(<DashboardPage />);

    expect(screen.getByRole('heading', { name: 'Bienvenido, Ambulancia05' })).toBeInTheDocument();
  });

  it('Cerrar sesión borra las cookies y vuelve al login', () => {
    cookiesCon(Cookies, { token: jwtAdmin() });
    render(<DashboardPage />);
    const boton = screen.getByRole('button', { name: 'Cerrar sesión' });

    fireEvent.mouseEnter(boton);
    expect(boton.style.backgroundColor).toBe('rgb(252, 228, 225)');
    fireEvent.mouseLeave(boton);
    fireEvent.click(boton);

    expect(Cookies.remove).toHaveBeenCalledWith('token');
    expect(Cookies.remove).toHaveBeenCalledWith('usuario');
    expect(push).toHaveBeenCalledWith('/login');
  });
});

describe('dashboard/page.js · menú según el rol', () => {
  it('admin ve solo las opciones de administración', () => {
    cookiesCon(Cookies, { token: jwtAdmin() });

    render(<DashboardPage />);

    expect(screen.getByText('Administración')).toBeInTheDocument();
    expect(enlaces()).toEqual([
      '/dashboard/usuarios', '/dashboard/inventario', '/dashboard/reportes-admin',
      '/dashboard/ambulancias', '/dashboard/centros',
    ]);
    expect(screen.queryByText('Entregar insumo')).not.toBeInTheDocument();
  });

  it('ambulancia ve solo sus acciones operativas', () => {
    cookiesCon(Cookies, { token: jwtAmbulancia() });

    render(<DashboardPage />);

    expect(screen.getByText('Acciones disponibles')).toBeInTheDocument();
    expect(enlaces()).toEqual([
      '/dashboard/entregar', '/dashboard/recoger', '/dashboard/dano', '/dashboard/reportes',
    ]);
    expect(screen.queryByText('Gestión de Usuarios')).not.toBeInTheDocument();
  });

  it('las tarjetas se resaltan al pasar el mouse', () => {
    cookiesCon(Cookies, { token: jwtAmbulancia() });
    render(<DashboardPage />);
    const tarjeta = screen.getByRole('button', { name: /Entregar insumo/ });

    fireEvent.mouseEnter(tarjeta);
    expect(tarjeta.style.transform).toBe('translateY(-2px)');
    fireEvent.mouseLeave(tarjeta);
    expect(tarjeta.style.transform).toBe('none');
  });
});
