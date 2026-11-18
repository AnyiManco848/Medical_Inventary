import { redirect } from 'next/navigation';

// La raíz redirige automáticamente al login
export default function Home() {
  redirect('/login');
}
