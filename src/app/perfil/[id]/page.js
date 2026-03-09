'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PerfilIdPage() {
  const router = useRouter()
  const { id: profileId } = useParams()
  const [currentUser, setCurrentUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [listings, setListings] = useState([])
  const [forSaleCount, setForSaleCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profileId) return
    const sb = createClient()
    const load = async () => {
      const { data: { user } } = await sb.auth.getUser()
      setCurrentUser(user)
      const [{ data: prof }, { data: lstgs }, { count }] = await Promise.all([
        sb.from('profiles').select('username, avatar_url, bio, created_at').eq('id', profileId).single(),
        sb.from('listings').select('id, card_name, card_set, card_image, condition, price, display_type').eq('seller_id', profileId).eq('sold', false).order('created_at', { ascending: false }).limit(12),
        sb.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', profileId).eq('sold', false),
      ])
      setProfile(prof)
      setListings(lstgs || [])
      setForSaleCount(count || 0)
      setLoading(false)
    }
    load()
  }, [profileId])

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>Cargando perfil...</div>

  const isOwn = currentUser?.id === profileId
  if (isOwn) { router.replace('/perfil'); return null }

  const username = profile?.username || profileId?.slice(0, 8) || '—'
  const initial = username[0]?.toUpperCase() || '?'
  const condColor = { NM: '#2ed573', LP: '#ffa502', MP: '#ff4757', PSA10: '#d4f53c', PSA9: '#38bdf8', PSA8: '#a78bfa' }
  const condBg = { NM: 'rgba(46,213,115,0.15)', LP: 'rgba(255,165,2,0.15)', MP: 'rgba(255,71,87,0.15)', PSA10: 'rgba(212,245,60,0.12)', PSA9: 'rgba(56,189,248,0.12)', PSA8: 'rgba(167,139,250,0.12)' }

  return (
    <>
      <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '36px 40px 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-100px', right: '-60px', width: '400px', height: '400px', background: 'radial-gradient(circle,rgba(212,245,60,0.05) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '24px', alignItems: 'start' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg,#3d2a6e,#d4f53c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: '#08080d', border: '2px solid rgba(212,245,60,0.3)' }}>
            {initial}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '2px' }}>{username}</div>
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '4px', padding: '3px 10px', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)' }}>Particular</div>
            </div>
            {profile?.bio ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text2)', fontWeight: 300, lineHeight: 1.6 }}>{profile.bio}</div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text3)', fontStyle: 'italic' }}>Sin descripción.</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
            <button onClick={() => router.push(`/mensajes`)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 20px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '1px', cursor: 'pointer', textTransform: 'uppercase' }}>
              💬 Enviar mensaje
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)' }}>
          {[
            { val: '—', label: 'Ventas totales', color: 'var(--accent)' },
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '1px' }}>EN VENTA AHORA</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)' }}>{forSaleCount} cartas publicadas</div>
            </div>
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
                    {l.condition && <span style={{ position: 'absolute', top: '6px', left: '6px', background: condBg[l.condition] || '', border: `1px solid ${condColor[l.condition] || 'var(--border)'}`, color: condColor[l.condition] || 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.58rem', fontWeight: 700, padding: '2px 6px', borderRadius: '3px' }}>{l.condition}</span>}
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
              No hay cartas en venta.
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '1px', marginBottom: '14px' }}>RESUMEN DEL VENDEDOR</div>
            {[['Tiempo de respuesta', '< 1 hora', 'var(--nm)'], ['Plazo de envío', '24–48h', null], ['Envío internacional', 'Sí', 'var(--nm)'], ['Acepta ofertas', 'Sí', 'var(--nm)']].map(([label, val, color]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text3)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 500, color: color || 'var(--text)' }}>{val}</span>
              </div>
            ))}
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => router.push('/mensajes')} style={{ width: '100%', padding: '10px', border: 'none', borderRadius: '5px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>
                💬 Enviar mensaje
              </button>
            </div>
          </div>
          <span onClick={() => {}} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', cursor: 'pointer', display: 'block', textAlign: 'center' }}>⚑ Reportar este perfil</span>
        </div>
      </div>
    </>
  )
}
