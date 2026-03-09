'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PerfilPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [listings, setListings] = useState([])
  const [forSaleCount, setForSaleCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      setUser(user)
      const profileId = user.id
      const [{ data: prof }, { data: listings }, { count }] = await Promise.all([
        sb.from('profiles').select('username, avatar_url, bio, created_at').eq('id', profileId).single(),
        sb.from('listings').select('id, card_name, card_set, card_image, condition, price, display_type').eq('seller_id', profileId).eq('sold', false).order('created_at', { ascending: false }).limit(12),
        sb.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', profileId).eq('sold', false),
      ])
      setProfile(prof)
      setListings(listings || [])
      setForSaleCount(count || 0)
      setLoading(false)
    })
  }, [router])

  const logout = async () => {
    const sb = createClient()
    await sb.auth.signOut()
    router.push('/auth')
  }

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>Cargando perfil...</div>

  const username = profile?.username || user?.email?.split('@')[0] || '—'
  const initial = username[0]?.toUpperCase() || '?'
  const condColor = { NM: '#2ed573', LP: '#ffa502', MP: '#ff4757', PSA10: '#d4f53c', PSA9: '#38bdf8', PSA8: '#a78bfa' }
  const condBg = { NM: 'rgba(46,213,115,0.15)', LP: 'rgba(255,165,2,0.15)', MP: 'rgba(255,71,87,0.15)', PSA10: 'rgba(212,245,60,0.12)', PSA9: 'rgba(56,189,248,0.12)', PSA8: 'rgba(167,139,250,0.12)' }

  return (
    <>
      {/* Profile header */}
      <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '36px 40px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-100px', right: '-60px', width: '400px', height: '400px', background: 'radial-gradient(circle,rgba(212,245,60,0.05) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '24px', alignItems: 'start' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg,#3d2a6e,#d4f53c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: '#08080d', border: '2px solid rgba(212,245,60,0.3)' }}>
            {initial}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '2px' }}>{username}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '4px', padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)' }}>Particular</div>
            </div>
            {profile?.bio ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text2)', fontWeight: 300, lineHeight: 1.6, maxWidth: '560px' }}>{profile.bio}</div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text3)', fontStyle: 'italic' }}>Aún no has añadido una descripción.</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 20px', minWidth: '200px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>MI CUENTA</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text2)', marginBottom: '12px', wordBreak: 'break-all' }}>{user?.email}</div>
              <button onClick={logout} style={{ width: '100%', padding: '9px', border: '1px solid rgba(255,71,87,0.3)', borderRadius: '5px', background: 'none', color: '#ff4757', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }}>
          {[
            { val: '0', label: 'Ventas totales', color: 'var(--accent)' },
            { val: '—', label: 'Valoración positiva', color: 'var(--nm)' },
            { val: String(forSaleCount), label: 'Cartas en venta', color: 'var(--text)' },
            { val: '—', label: 'Tiempo de respuesta', color: 'var(--text)' },
            { val: '—', label: 'Puntuación media', color: 'var(--nm)' },
          ].map((stat, i) => (
            <div key={i} style={{ padding: '16px 24px', textAlign: 'center', borderRight: i < 4 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '1px', lineHeight: 1, marginBottom: '5px', color: stat.color }}>{stat.val}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 40px 80px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        {/* Left */}
        <div>
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '1px' }}>EN VENTA AHORA</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)' }}>{forSaleCount} cartas publicadas</div>
              </div>
              <span onClick={() => router.push('/vender')} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent)', cursor: 'pointer' }}>+ Publicar carta</span>
            </div>
            {listings.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: '10px' }}>
                {listings.map(l => (
                  <div key={l.id} onClick={() => router.push(`/checkout?listing_id=${l.id}`)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <div style={{ position: 'relative', width: '100%', height: '120px', background: 'linear-gradient(135deg,#13132a,#1a1a35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {l.card_image ? <img src={l.card_image} alt={l.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} onError={e => e.target.style.display='none'} /> : <span style={{ fontSize: '2rem' }}>🎴</span>}
                      {l.condition && <span style={{ position: 'absolute', top: '6px', left: '6px', background: condBg[l.condition] || 'rgba(152,152,184,0.1)', border: `1px solid ${condColor[l.condition] || 'var(--border)'}`, color: condColor[l.condition] || 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.58rem', fontWeight: 700, padding: '2px 6px', borderRadius: '3px' }}>{l.condition}</span>}
                    </div>
                    <div style={{ padding: '9px 10px' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '1px' }}>{l.card_name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text3)', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.card_set}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.5px', color: 'var(--accent)' }}>€{parseFloat(l.price).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text3)', border: '1.5px dashed var(--border)', borderRadius: '8px' }}>
                Aún no tienes cartas en venta. <span onClick={() => router.push('/vender')} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Publicar ahora →</span>
              </div>
            )}
          </div>

          {/* Sales history placeholder */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '1px' }}>VENTAS RECIENTES</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)' }}>Últimas transacciones completadas</div>
              </div>
            </div>
            <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text3)', border: '1.5px dashed var(--border)', borderRadius: '8px' }}>
              Aún no has realizado ninguna venta.
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '1px', marginBottom: '14px' }}>RESUMEN DEL VENDEDOR</div>
            {[['Tiempo de respuesta', '< 1 hora', 'var(--nm)'], ['Plazo de envío', '24–48h', null], ['Envío internacional', 'Sí', 'var(--nm)'], ['Acepta ofertas', 'Sí', 'var(--nm)']].map(([label, val, color]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text3)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 500, color: color || 'var(--text)' }}>{val}</span>
              </div>
            ))}
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => router.push('/vender')} style={{ width: '100%', padding: '10px', border: 'none', borderRadius: '5px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '1px', cursor: 'pointer', textTransform: 'uppercase' }}>+ Publicar carta</button>
              <button onClick={() => router.push('/portfolio')} style={{ width: '100%', padding: '10px', border: '1px solid var(--border2)', borderRadius: '5px', background: 'none', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: 'pointer' }}>Ver mi portfolio</button>
            </div>
          </div>

          {/* Badges */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '1px', marginBottom: '14px' }}>LOGROS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[['⚡', 'Respuesta rápida'], ['✅', 'Verificado Pple'], ['⭐', 'Miembro activo'], ['🌍', 'Envío EU']].map(([icon, name]) => (
                <div key={name} style={{ padding: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{icon}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', letterSpacing: '0.5px', lineHeight: 1.3 }}>{name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
