import { Bebas_Neue, DM_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'

const bebasNeue = Bebas_Neue({
  weight: '400',
  variable: '--font-bebas',
  subsets: ['latin'],
  display: 'swap',
})

const dmMono = DM_Mono({
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  subsets: ['latin'],
  display: 'swap',
})

const plusJakarta = Plus_Jakarta_Sans({
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata = {
  title: 'Pple.TCG — Marketplace de cartas Pokémon',
  description:
    'Compra y vende cartas Pokémon TCG en español. Raw, slabs PSA, portfolio y verificación.',
  keywords: ['pokemon tcg', 'cartas pokemon', 'marketplace', 'psa', 'coleccionables'],
}

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${bebasNeue.variable} ${dmMono.variable} ${plusJakarta.variable}`}
    >
      <body>
        <Nav />
        {children}
      </body>
    </html>
  )
}
