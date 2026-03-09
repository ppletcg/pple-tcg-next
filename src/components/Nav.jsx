'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TABS = [
  { label: 'Mercado',      href: '/' },
  { label: 'Vender',       href: '/vender' },
  { label: 'Verificación', href: '/verificacion' },
  { label: 'Portfolio',    href: '/portfolio' },
  { label: 'Mensajes',     href: '/mensajes' },
]

export default function Nav() {
  const pathname = usePathname()
  const [user, setUser] = useState(undefined) // undefined = loading

  useEffect(() => {
    const sb = createClient()

    sb.auth.getUser().then(({ data: { user } }) => setUser(user ?? null))

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const initial = user?.email ? user.email[0].toUpperCase() : null

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 40px',
      height: '60px',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      background: 'rgba(8,8,13,0.95)',
      backdropFilter: 'blur(24px)',
      zIndex: 100,
    }}>
      {/* Logo */}
      <Link href="/" style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.8rem',
        letterSpacing: '3px',
        color: 'var(--text)',
        lineHeight: 1,
        textDecoration: 'none',
      }}>
        PPLE<span style={{ color: 'var(--accent)' }}>.</span>TCG
      </Link>

      {/* Tabs centrales */}
      <div style={{
        display: 'flex',
        gap: 0,
        border: '1px solid var(--border)',
        borderRadius: '6px',
        overflow: 'hidden',
      }}>
        {TABS.map((tab, i) => {
          const isActive =
            tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: '7px 22px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: isActive ? '#08080d' : 'var(--text2)',
                background: isActive ? 'var(--accent)' : 'none',
                borderRight: i < TABS.length - 1 ? '1px solid var(--border)' : 'none',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Derecha: live dot + auth */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        {/* Live dot */}
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.68rem',
          color: 'var(--nm)',
          letterSpacing: '0.5px',
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--nm)',
            animation: 'pulse 2s infinite',
            boxShadow: '0 0 6px var(--nm)',
            display: 'inline-block',
          }} />
          EN VIVO
        </span>

        {/* Auth — undefined = cargando (no renderizar nada) */}
        {user === undefined ? null : user ? (
          <Link
            href="/perfil"
            title={user.email}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3d2a6e, #d4f53c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#08080d',
              border: '1px solid rgba(212,245,60,0.3)',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            {initial}
          </Link>
        ) : (
          <>
            <Link href="/auth" className="btn-outline">Entrar</Link>
            <Link href="/auth" className="btn-accent">Registrarse</Link>
          </>
        )}
      </div>
    </nav>
  )
}
