import { describe, it, expect, vi } from 'vitest';

const redirect = vi.fn();
vi.mock('next/navigation', () => ({ redirect: (...args) => redirect(...args) }));

import Home from '../app/page';

describe('app/page.js', () => {
  it('la raíz redirige al login', () => {
    Home();

    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
