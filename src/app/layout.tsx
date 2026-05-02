import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Corona – Control de Calidad Esmaltado',
  description: 'Sistema de inspección de calidad para el proceso de esmaltado',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" defer />
      </head>
      <body>{children}</body>
    </html>
  )
}
