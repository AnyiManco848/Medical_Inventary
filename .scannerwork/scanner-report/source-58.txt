import "./globals.css";

export const metadata = {
  title: "Medical Inventary",
  description: "Sistema de inventario médico",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full" style={{ backgroundColor: '#f0f5f2', color: '#1a2e25' }}>
        {children}
      </body>
    </html>
  );
}
