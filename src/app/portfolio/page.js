'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const COND_COLOR = { NM: '#2ed573', LP: '#ffa502', MP: '#ff4757', PSA10: '#d4f53c', PSA9: '#38bdf8', PSA8: '#a78bfa' }
const COND_BG   = { NM: 'rgba(46,213,115,0.15)', LP: 'rgba(255,165,2,0.15)', MP: 'rgba(255,71,87,0.15)', PSA10: 'rgba(212,245,60,0.12)', PSA9: 'rgba(56,189,248,0.12)', PSA8: 'rgba(167,139,250,0.12)' }
const CONDITIONS = [
  { v:'NM', label:'NM', desc:'Near Mint' }, { v:'LP', label:'LP', desc:'Lightly Played' },
  { v:'MP', label:'MP', desc:'Mod. Played' }, { v:'PSA10', label:'PSA 10', desc:'Gem Mint' },
  { v:'PSA9', label:'PSA 9', desc:'Mint' }, { v:'PSA8', label:'PSA 8', desc:'NM-MT' },
]

export default function PortfolioPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [items, setItems] = useState([])
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState('raw') // raw | slab
  const [searchQ, setSearchQ] = useState('')
  const [searchRes, setSearchRes] = useState([])
  const [searching, setSearching] = useState(false)
  const [selCard, setSelCard] = useState(null)
  const [selCond, setSelCond] = useState('NM')
  const [selType, setSelType] = useState('raw')
  const [paidPrice, setPaidPrice] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (sb, userId) => {
    const [{ data: portfolio }, { data: lstgs }] = await Promise.all([
      sb.from('portfolio').select('id, card_id, card_name, card_set, card_image, condition, display_type, paid_price, quantity, status, cert').eq('user_id', userId).order('created_at', { ascending: false }),
      sb.from('listings').select('id, card_id, card_name, card_set, card_image, condition, price, display_type').eq('seller_id', userId).eq('sold', false).order('created_at', { ascending: false }),
    ])
    setItems(portfolio || [])
    setListings(lstgs || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      setUser(user)
      load(sb, user.id)
    })
  }, [router, load])

  const searchCards = useCallback(async (q) => {
    if (!q || q.length < 2) { setSearchRes([]); return }
    setSearching(true)
    try {
      const r = await fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(q)}`)
      const d = await r.json()
      setSearchRes(Array.isArray(d) ? d.slice(0, 10) : [])
    } catch { setSearchRes([]) }
    setSearching(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchCards(searchQ), 400)
    return () => clearTimeout(t)
  }, [searchQ, searchCards])

  const saveCard = async () => {
    if (!selCard || !user) return
    setSaving(true)
    const sb = createClient()
    await sb.from('profiles').upsert({ id: user.id, username: user.email.split('@')[0] }, { onConflict: 'id' })
    await sb.from('portfolio').insert({
      user_id: user.id,
      card_id: selCard.id,
      card_name: selCard.name,
      card_set: selCard.set,
      card_image: selCard.image,
      condition: selCond,
      display_type: selType,
      paid_price: paidPrice ? parseFloat(paidPrice) : null,
      quantity: 1,
      status: 'owned',
    })
    setSaving(false)
    setModalOpen(false)
    setSelCard(null); setSearchQ(''); setSearchRes([]); setSelCond('NM'); setSelType('raw'); setPaidPrice('')
    load(sb, user.id)
  }

  const openModal = (type) => { setModalType(type); setSelType(type); setModalOpen(true) }

  const raw = items.filter(i => i.display_type === 'raw')
  const slabs = items.filter(i => i.display_type === 'slab')

  const CardGrid = ({ cards, emptyMsg }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '10px' }}>
      {cards.length === 0 ? (
        <div onClick={() => openModal('raw')} style={{ gridColumn: '1/-1', padding: '32px', textAlign: 'center', border: '1.5px dashed var(--border)', borderRadius: '10px', cursor: 'pointer' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px', opacity: 0.5 }}>+</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)' }}>{emptyMsg}</div>
        </div>
      ) : cards.map(c => {
        const color = COND_COLOR[c.condition] || 'var(--text2)'
        const bg = COND_BG[c.condition] || ''
        const isSlab = c.display_type === 'slab'
        return (
          <div key={c.id} style={{ background: 'var(--surface)', border: `1px solid ${c.status === 'for_sale' ? 'rgba(212,245,60,0.2)' : 'var(--border)'}`, borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
          >
            {c.status === 'for_sale' && <span style={{ position: 'absolute', top: '7px', right: '7px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '1px', padding: '2px 6px', borderRadius: '3px', zIndex: 1 }}>EN VENTA</span>}
            {(c.quantity || 1) > 1 && <span style={{ position: 'absolute', top: '7px', left: '7px', background: '#08080d', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(212,245,60,0.35)', zIndex: 1 }}>x{c.quantity}</span>}
            <div style={{ position: 'relative', width: '100%', height: '130px', background: isSlab ? 'linear-gradient(135deg,#1a1a0a,#2a2a10)' : 'linear-gradient(135deg,#13132a,#1a1a35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {c.card_image ? <img src={c.card_image} alt={c.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} onError={e => e.target.style.display='none'} /> : <span style={{ fontSize: '2rem' }}>🎴</span>}
              <span style={{ position: 'absolute', bottom: '6px', left: '6px', background: bg, border: `1px solid ${color}`, color, fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: '3px', letterSpacing: '0.5px' }}>{c.condition}</span>
            </div>
            <div style={{ padding: '10px 11px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '1px' }}>{c.card_name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text3)', marginBottom: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.card_set}</div>
              {c.paid_price && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text2)' }}>Pagado: €{parseFloat(c.paid_price).toFixed(2)}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>Cargando portfolio...</div>

  const totalCost = items.reduce((s, i) => s + (i.paid_price ? parseFloat(i.paid_price) * (i.quantity || 1) : 0), 0)

  return (
    <>
      {/* Header */}
      <div style={{ padding: '32px 40px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Mi colección · Actualizado hoy</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', letterSpacing: '2px', lineHeight: 1, marginBottom: '4px' }}>PORTFOLIO</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)', letterSpacing: '1px' }}>{user?.email?.split('@')[0]}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{ padding: '8px 16px', border: '1px solid var(--border2)', borderRadius: '6px', background: 'none', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: 'pointer' }}>Exportar CSV</button>
          <button onClick={() => openModal('raw')} style={{ padding: '8px 18px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>+ Añadir</button>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '28px 40px 80px' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '10px', marginBottom: '24px' }}>
          {[
            { label: 'Total cartas', val: items.length, color: 'var(--accent)', highlight: true },
            { label: 'RAW', val: raw.length, color: 'var(--text)' },
            { label: 'Slabs PSA', val: slabs.length, color: 'var(--text)' },
            { label: 'En venta', val: listings.length, color: 'var(--nm)' },
            { label: 'Anuncios activos', val: listings.length, color: 'var(--text)' },
            { label: 'Coste total', val: `€${totalCost.toFixed(0)}`, color: 'var(--text)' },
          ].map((k, i) => (
            <div key={i} style={{ background: k.highlight ? 'var(--accent-dim)' : 'var(--surface)', border: `1px solid ${k.highlight ? 'rgba(212,245,60,0.2)' : 'var(--border)'}`, borderRadius: '10px', padding: '16px 18px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>{k.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', letterSpacing: '1px', lineHeight: 1, color: k.color }}>{k.val}</div>
            </div>
          ))}
        </div>

        {/* My listings section */}
        {listings.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <SectionHeader icon="📌" title="MIS ANUNCIOS" count={`${listings.length} activos`} value={`€${listings.reduce((s,l) => s + parseFloat(l.price||0), 0).toFixed(0)}`} onAdd={() => router.push('/vender')} addLabel="+ Publicar" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '10px' }}>
              {listings.map(l => (
                <div key={l.id} onClick={() => router.push(`/checkout?listing_id=${l.id}`)} style={{ background: 'var(--surface)', border: '1px solid rgba(212,245,60,0.15)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = ''}
                >
                  <div style={{ width: '100%', height: '120px', background: 'linear-gradient(135deg,#13132a,#1a1a35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {l.card_image ? <img src={l.card_image} alt={l.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} onError={e => e.target.style.display='none'} /> : <span style={{ fontSize: '2rem' }}>🎴</span>}
                  </div>
                  <div style={{ padding: '9px 10px' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '1px' }}>{l.card_name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text3)', marginBottom: '6px' }}>{l.card_set}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--accent)' }}>€{parseFloat(l.price).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RAW */}
        <div style={{ marginBottom: '28px' }}>
          <SectionHeader icon="🃏" title="RAW" count={`${raw.length} cartas`} onAdd={() => openModal('raw')} />
          <CardGrid cards={raw} emptyMsg="Añade tu primera carta raw" />
        </div>

        {/* PSA Slabs */}
        <div style={{ marginBottom: '28px' }}>
          <SectionHeader icon="🏆" title="SLABS PSA" count={`${slabs.length} cartas`} onAdd={() => openModal('slab')} />
          <CardGrid cards={slabs} emptyMsg="Añade tu primer slab" />
        </div>
      </div>

      {/* Add card modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,8,0.9)', backdropFilter: 'blur(16px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '28px', animation: 'mIn 0.2s ease' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '1px', marginBottom: '4px' }}>AÑADIR CARTA</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', letterSpacing: '0.5px', marginBottom: '20px' }}>Busca la carta y añádela a tu colección</div>

            {/* Card search */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Nombre de la carta</label>
              <input style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }} type="text" placeholder="Buscar..." value={searchQ} onChange={e => { setSearchQ(e.target.value); setSelCard(null) }} />
              {searching && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: '4px' }}>Buscando...</div>}
              {searchRes.length > 0 && !selCard && (
                <div style={{ maxHeight: '180px', overflowY: 'auto', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {searchRes.map(c => (
                    <div key={c.id} onClick={() => { setSelCard({ id: c.id, name: c.name, set: c.set?.name || '', image: c.image ? `${c.image}/high.webp` : '' }); setSearchQ(c.name); setSearchRes([]) }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      {c.image && <img src={`${c.image}/high.webp`} alt={c.name} style={{ width: '28px', height: '38px', objectFit: 'contain', borderRadius: '3px' }} onError={e => e.target.style.display='none'} />}
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '1px' }}>{c.name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)' }}>{c.set?.name || ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Type */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Tipo</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[{ v:'raw', l:'RAW' }, { v:'slab', l:'SLAB' }].map(t => (
                  <button key={t.v} onClick={() => setSelType(t.v)} style={{ flex: 1, padding: '8px', border: `1px solid ${selType === t.v ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', background: selType === t.v ? 'var(--accent-dim)' : 'none', color: selType === t.v ? 'var(--accent)' : 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>{t.l}</button>
                ))}
              </div>
            </div>

            {/* Condition */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Condición</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px' }}>
                {CONDITIONS.map(c => (
                  <div key={c.v} onClick={() => setSelCond(c.v)} style={{ padding: '8px', border: `1px solid ${selCond === c.v ? (COND_COLOR[c.v] || 'var(--accent)') : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'center', background: selCond === c.v ? (COND_BG[c.v] || 'var(--accent-dim)') : 'var(--bg2)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, color: COND_COLOR[c.v] || 'var(--text)' }}>{c.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Paid price */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Precio pagado (opcional)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }}>€</span>
                <input style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 10px 10px 24px', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }} type="number" step="0.01" min="0" placeholder="0.00" value={paidPrice} onChange={e => setPaidPrice(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setModalOpen(false)} style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={saveCard} disabled={!selCard || saving} style={{ flex: 2, padding: '10px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: !selCard || saving ? 'not-allowed' : 'pointer', opacity: !selCard || saving ? 0.5 : 1, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {saving ? 'Guardando...' : 'Añadir al portfolio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SectionHeader({ icon, title, count, value, onAdd, addLabel = '+ Añadir' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', background: 'var(--nm-bg)', border: '1px solid rgba(46,213,115,0.2)' }}>{icon}</div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '1px' }}>{title}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', letterSpacing: '1px' }}>{count}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {value && <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.5px', color: 'var(--accent)' }}>{value}</div>}
        <button onClick={onAdd} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', border: '1px solid var(--border2)', borderRadius: '5px', background: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.3px' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text3)' }}
        >{addLabel}</button>
      </div>
    </div>
  )
}
