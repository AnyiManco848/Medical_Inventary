import "./globals.css";

export const metadata = {
  title: "Medical Inventary",
  description: "Sistema de inventario médico",
};

// viewport-fit=cover: permite usar safe-area-inset (iPhone con notch).
// interactive-widget=resizes-content: el teclado virtual reduce el viewport, así
// las barras fijas quedan encima del teclado en vez de quedar tapadas.
// No se limita el zoom (accesibilidad).
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
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
